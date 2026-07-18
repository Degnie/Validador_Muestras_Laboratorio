import unicodedata
from pathlib import Path
from typing import TypeVar

import pandas as pd
from openpyxl import load_workbook
from pydantic import BaseModel, ValidationError

from app.core.column_aliases import COLUMN_ALIASES

MAX_EXCEL_SIZE_MB = 20
ModelT = TypeVar("ModelT", bound=BaseModel)


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


def assert_safe_excel_file(path: Path, max_size_mb: float = MAX_EXCEL_SIZE_MB) -> None:
    """Rejects files that aren't a plain .xlsx or that are suspiciously large before we parse them."""
    path = Path(path)
    if path.suffix.lower() != ".xlsx":
        raise ValueError(f"Extensión no permitida (se esperaba .xlsx): {path.suffix}")
    size_mb = path.stat().st_size / (1024 * 1024)
    if size_mb > max_size_mb:
        raise ValueError(f"Archivo demasiado grande: {size_mb:.2f} MB (máximo {max_size_mb} MB)")


def read_excel_normalized(path: Path, batch_size: int = 500) -> pd.DataFrame:
    """Streams the sheet via openpyxl's read_only mode (no full-workbook object graph in
    memory) and assembles the DataFrame in batches, instead of pandas.read_excel loading
    everything at once."""
    workbook = load_workbook(path, read_only=True, data_only=True)
    try:
        sheet = workbook.active
        rows = sheet.iter_rows(values_only=True)
        header = next(rows, None)
        columns = [_canonical_column(c) for c in header] if header else []

        batches: list[pd.DataFrame] = []
        batch: list[tuple] = []
        for row in rows:
            batch.append(row)
            if len(batch) >= batch_size:
                batches.append(pd.DataFrame(batch, columns=columns))
                batch = []
        if batch:
            batches.append(pd.DataFrame(batch, columns=columns))
    finally:
        workbook.close()

    df = pd.concat(batches, ignore_index=True) if batches else pd.DataFrame(columns=columns)
    for col in df.select_dtypes(include=["object", "str"]).columns:
        df[col] = df[col].apply(lambda v: v.strip() if isinstance(v, str) else v)
    return df


def validate_rows(df: pd.DataFrame, schema: type[ModelT]) -> pd.DataFrame:
    """Runs every row through a Pydantic schema (type coercion + required fields), rejecting
    the whole file on the first bad row rather than silently ingesting garbage."""
    validated = []
    for i, row in enumerate(df.to_dict(orient="records")):
        try:
            validated.append(schema(**row).model_dump())
        except ValidationError as exc:
            raise ValueError(f"Fila {i} inválida: {exc}") from exc
    return pd.DataFrame(validated, columns=list(schema.model_fields.keys()))


def check_file_freshness(paths: dict[str, Path], max_lag_days: float = 1) -> list[str]:
    """Returns area names whose file is more than max_lag_days older than the most recent one."""
    mtimes = {area: Path(p).stat().st_mtime for area, p in paths.items()}
    newest = max(mtimes.values())
    max_lag_seconds = max_lag_days * 86400
    return [area for area, mtime in mtimes.items() if newest - mtime > max_lag_seconds]
