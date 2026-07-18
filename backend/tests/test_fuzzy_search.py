import pandas as pd

from app.services.fuzzy_match import correct_ids, search_by_code


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


def test_search_by_code_ranks_closest_matches_first():
    ids = ["M-001", "M-002", "M-010", "X-999"]

    result = search_by_code("M-00", ids)

    assert result[0] in {"M-001", "M-002"}
    assert "X-999" not in result


def test_search_by_code_finds_exact_and_typo_matches():
    ids = ["M-001", "M-002", "M-006"]

    result = search_by_code("M-0O6", ids)

    assert "M-006" in result


def test_search_by_code_respects_limit():
    ids = [f"M-{i:03d}" for i in range(50)]

    result = search_by_code("M-0", ids, limit=5)

    assert len(result) == 5


def test_search_by_code_empty_query_returns_empty():
    result = search_by_code("", ["M-001", "M-002"])

    assert result == []


def test_search_by_code_exact_code_does_not_match_unrelated_similar_codes():
    ids = ["M-001", "M-002", "M-003", "M-004", "M-005", "M-006"]

    result = search_by_code("M-006", ids)

    assert result == ["M-006"]


def test_search_by_code_strips_control_characters_before_matching():
    ids = ["M-001", "M-002"]

    result = search_by_code("M-001\x00\x1b", ids)

    assert result == ["M-001"]


def test_search_by_code_caps_an_oversized_query_instead_of_scanning_it_whole():
    ids = ["M-001", "M-002"]

    result = search_by_code("M" * 10_000, ids)

    assert result == []


def test_search_by_code_query_that_is_only_control_characters_returns_empty():
    result = search_by_code("\x00\x01\x02", ["M-001"])

    assert result == []


def test_search_by_code_logs_a_warning_when_truncating_an_oversized_query(caplog):
    import logging

    with caplog.at_level(logging.WARNING, logger="app.services.fuzzy_match"):
        search_by_code("M" * 300, ["M-001"])

    assert any("trunca" in record.message for record in caplog.records)


def test_search_by_code_does_not_log_when_query_is_within_the_limit(caplog):
    import logging

    with caplog.at_level(logging.WARNING, logger="app.services.fuzzy_match"):
        search_by_code("M-001", ["M-001"])

    assert caplog.records == []
