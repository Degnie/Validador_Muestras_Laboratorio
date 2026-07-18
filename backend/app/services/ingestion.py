import unicodedata
from pathlib import Path

import pandas as pd

from app.core.column_aliases import COLUMN_ALIASES


def _normalize_key(name: str) -> str:
    stripped = str(name).strip().lower()
    no_accents = unicodedata.normalize("NFKD", stripped).encode("ascii", "ignore").decode()
    return no_accents.replace(" ", "").replace("_", "")


def _canonical_column(name: str) -> str:
    key = _normalize_key(name)
    if key in COLUMN_ALIASES:
        return COLUMN_ALIASES[key]
    # ponytail: no alias on file -> best-effort snake_case, add alias entries as new variants appear
    return str(name).strip().lower().replace(" ", "_")


def read_excel_normalized(path: Path) -> pd.DataFrame:
    df = pd.read_excel(path)
    df.columns = [_canonical_column(c) for c in df.columns]
    for col in df.select_dtypes(include=["object", "str"]).columns:
        df[col] = df[col].apply(lambda v: v.strip() if isinstance(v, str) else v)
    return df


def check_file_freshness(paths: dict[str, Path], max_lag_days: float = 1) -> list[str]:
    """Returns area names whose file is more than max_lag_days older than the most recent one."""
    mtimes = {area: Path(p).stat().st_mtime for area, p in paths.items()}
    newest = max(mtimes.values())
    max_lag_seconds = max_lag_days * 86400
    return [area for area, mtime in mtimes.items() if newest - mtime > max_lag_seconds]
