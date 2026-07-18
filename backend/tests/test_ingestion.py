import time

import pandas as pd
import pytest
from pydantic import BaseModel

from app.services.ingestion import (
    assert_safe_excel_file,
    check_file_freshness,
    read_excel_normalized,
    validate_rows,
)


def test_normalizes_column_names_with_accents_case_and_spaces(tmp_xlsx):
    df = pd.DataFrame({" ID_Muestra ": ["M-001"], "Fecha Recepción": ["2026-07-01"]})
    path = tmp_xlsx("area1.xlsx", df)

    result = read_excel_normalized(path)

    assert list(result.columns) == ["id_muestra", "fecha_recepcion"]


def test_normalizes_known_column_aliases(tmp_xlsx):
    df = pd.DataFrame({"IdMuestra": ["M-001"], "Prueba": ["pH"]})
    path = tmp_xlsx("area2.xlsx", df)

    result = read_excel_normalized(path)

    assert "id_muestra" in result.columns


def test_strips_whitespace_from_string_values(tmp_xlsx):
    df = pd.DataFrame({"id_muestra": [" M-001 "]})
    path = tmp_xlsx("area1.xlsx", df)

    result = read_excel_normalized(path)

    assert result["id_muestra"].iloc[0] == "M-001"


def test_check_file_freshness_flags_stale_files(tmp_path):
    fresh = tmp_path / "fresh.xlsx"
    stale = tmp_path / "stale.xlsx"
    fresh.write_text("x")
    stale.write_text("x")

    old_time = time.time() - 3 * 86400
    import os

    os.utime(stale, (old_time, old_time))

    result = check_file_freshness({"area1": fresh, "area2": stale}, max_lag_days=1)

    assert result == ["area2"]


def test_check_file_freshness_returns_empty_when_all_fresh(tmp_path):
    a = tmp_path / "a.xlsx"
    b = tmp_path / "b.xlsx"
    a.write_text("x")
    b.write_text("x")

    result = check_file_freshness({"area1": a, "area2": b}, max_lag_days=1)

    assert result == []


def test_reads_all_rows_across_multiple_batches(tmp_xlsx):
    df = pd.DataFrame({"id_muestra": [f"M-{i:03d}" for i in range(1250)]})
    path = tmp_xlsx("grande.xlsx", df)

    result = read_excel_normalized(path, batch_size=200)

    assert len(result) == 1250
    assert result["id_muestra"].iloc[-1] == "M-1249"


def test_assert_safe_excel_file_rejects_wrong_extension(tmp_path):
    fake = tmp_path / "no_es_excel.txt"
    fake.write_text("no soy un excel")

    with pytest.raises(ValueError):
        assert_safe_excel_file(fake)


def test_assert_safe_excel_file_rejects_oversized_file(tmp_path):
    huge = tmp_path / "grande.xlsx"
    huge.write_bytes(b"0" * 1024)

    with pytest.raises(ValueError):
        assert_safe_excel_file(huge, max_size_mb=0.0001)


def test_assert_safe_excel_file_accepts_valid_file(tmp_xlsx):
    path = tmp_xlsx("ok.xlsx", pd.DataFrame({"id_muestra": ["M-001"]}))

    assert_safe_excel_file(path)  # no debe lanzar


def test_assert_safe_excel_file_rejects_wrong_magic_bytes(tmp_path):
    # Extensión y tamaño correctos, pero el contenido no es un zip/xlsx real
    # (ej. un .txt o .exe renombrado a .xlsx).
    disfrazado = tmp_path / "disfrazado.xlsx"
    disfrazado.write_bytes(b"no soy un zip aunque tenga extension .xlsx")

    with pytest.raises(ValueError, match="contenido"):
        assert_safe_excel_file(disfrazado)


class _FilaChecklist(BaseModel):
    id_muestra: str
    prueba_requerida: str


def test_validate_rows_accepts_well_formed_rows():
    df = pd.DataFrame({"id_muestra": ["M-001"], "prueba_requerida": ["pH"]})

    result = validate_rows(df, _FilaChecklist)

    assert list(result.columns) == ["id_muestra", "prueba_requerida"]
    assert result["id_muestra"].iloc[0] == "M-001"


def test_validate_rows_rejects_row_missing_required_field():
    df = pd.DataFrame({"id_muestra": ["M-001"], "prueba_requerida": [None]})

    with pytest.raises(ValueError):
        validate_rows(df, _FilaChecklist)
