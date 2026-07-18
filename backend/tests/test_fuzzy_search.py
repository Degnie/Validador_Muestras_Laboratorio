import pandas as pd

from app.services.fuzzy_match import correct_ids


def test_corrects_typo_close_to_a_master_id():
    series = pd.Series(["M-0O6"])  # letter O instead of zero
    master_ids = ["M-001", "M-002", "M-006"]

    result = correct_ids(series, master_ids, threshold=80)

    assert result.iloc[0] == "M-006"


def test_leaves_exact_match_untouched():
    series = pd.Series(["M-001"])
    master_ids = ["M-001", "M-002"]

    result = correct_ids(series, master_ids, threshold=85)

    assert result.iloc[0] == "M-001"


def test_leaves_id_untouched_when_no_close_match():
    series = pd.Series(["X-999"])
    master_ids = ["M-001", "M-002"]

    result = correct_ids(series, master_ids, threshold=85)

    assert result.iloc[0] == "X-999"
