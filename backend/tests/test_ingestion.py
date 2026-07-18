import time

import pandas as pd

from app.services.ingestion import check_file_freshness, read_excel_normalized


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
