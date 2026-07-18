import pandas as pd
from thefuzz import process


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
