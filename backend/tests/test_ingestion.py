import time
import zipfile

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


def test_assert_safe_excel_file_rejects_zip_bomb_by_uncompressed_size(tmp_path):
    # Un solo part que comprime a ~1 KB pero se infla a >200 MB: pasa el chequeo de tamaño
    # del archivo en disco, pero no el de tamaño descomprimido total del zip.
    bomba = tmp_path / "bomba.xlsx"
    with zipfile.ZipFile(bomba, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("xl/sharedStrings.xml", "A" * (250 * 1024 * 1024))

    with pytest.raises(ValueError, match="Zip Bomb"):
        assert_safe_excel_file(bomba)


def test_assert_safe_excel_file_rejects_zip_bomb_by_compression_ratio(tmp_path):
    # Se mantiene bajo el techo de tamaño descomprimido absoluto, pero el ratio
    # comprimido/descomprimido es el de una bomba (texto repetitivo, no un xlsx real).
    bomba = tmp_path / "bomba_ratio.xlsx"
    with zipfile.ZipFile(bomba, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("xl/sharedStrings.xml", "A" * (50 * 1024 * 1024))

    with pytest.raises(ValueError, match="Zip Bomb"):
        assert_safe_excel_file(bomba, max_size_mb=1000)


def test_assert_safe_excel_file_rejects_corrupt_zip_with_valid_magic_bytes(tmp_path):
    # Magic bytes de zip correctos, pero el resto del archivo está truncado/corrupto.
    corrupto = tmp_path / "corrupto.xlsx"
    corrupto.write_bytes(b"PK\x03\x04" + b"\x00" * 100)

    with pytest.raises(ValueError):
        assert_safe_excel_file(corrupto)


class _FilaChecklist(BaseModel):
    id_muestra: str
    prueba_requerida: str


def test_validate_rows_accepts_well_formed_rows():
    df = pd.DataFrame({"id_muestra": ["M-001"], "prueba_requerida": ["pH"]})

    result, errores = validate_rows(df, _FilaChecklist)

    assert list(result.columns) == ["id_muestra", "prueba_requerida"]
    assert result["id_muestra"].iloc[0] == "M-001"
    assert errores == []


def test_validate_rows_skips_invalid_row_and_keeps_the_rest(tmp_path):
    # Partial success: una fila rota no debe tirar abajo el resto del lote.
    df = pd.DataFrame(
        {
            "id_muestra": ["M-001", "M-002", "M-003"],
            "prueba_requerida": ["pH", None, "Microbiologia"],
        }
    )

    result, errores = validate_rows(df, _FilaChecklist)

    assert list(result["id_muestra"]) == ["M-001", "M-003"]
    assert len(errores) == 1
    assert "Fila 1" in errores[0]


def test_validate_rows_returns_empty_result_when_every_row_is_invalid():
    df = pd.DataFrame({"id_muestra": ["M-001"], "prueba_requerida": [None]})

    result, errores = validate_rows(df, _FilaChecklist)

    assert result.empty
    assert len(errores) == 1
