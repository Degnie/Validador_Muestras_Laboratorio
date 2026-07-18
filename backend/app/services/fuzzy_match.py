import re

import pandas as pd
from thefuzz import process

# thefuzz/rapidfuzz never interprets the query as a pattern (no regex/injection surface), but
# `q` comes straight from the request. Strip control characters and cap length before it does
# any comparison work, so a garbage or oversized query is cheap to reject instead of just slow.
_CONTROL_CHARS = re.compile(r"[\x00-\x1f\x7f]")
MAX_QUERY_LENGTH = 200


def _sanitize_query(query: str) -> str:
    return _CONTROL_CHARS.sub("", query).strip()[:MAX_QUERY_LENGTH]


def correct_ids(series: pd.Series, master_ids: list[str], threshold: int = 80) -> pd.Series:
    """Snaps each id to its closest master id when the match is confident enough (typo correction)."""

    def _correct(value: str) -> str:
        if value in master_ids:
            return value
        match = process.extractOne(value, master_ids)
        if match and match[1] >= threshold:
            return match[0]
        return value

    return series.apply(_correct)


def search_by_code(query: str, ids: list[str], limit: int = 20, threshold: int = 75) -> list[str]:
    """Search-bar lookup: substring match first (what "buscar por código" actually means),
    only falling back to fuzzy scoring for typo tolerance when nothing contains the query.
    A pure similarity score is a bad fit here — short near-identical codes like "M-001" vs
    "M-006" score ~80% just for length/shape, which would flood exact-code searches."""
    if not query:
        return []
    query = _sanitize_query(query)
    if not query:
        return []
    needle = query.lower()
    substring_matches = [candidate for candidate in ids if needle in candidate.lower()]
    if substring_matches:
        return substring_matches[:limit]

    matches = process.extract(query, ids, limit=limit)
    return [candidate for candidate, score in matches if score >= threshold]
