import unicodedata
import zipfile
from pathlib import Path
from typing import TypeVar

import pandas as pd
from openpyxl import load_workbook
from pydantic import BaseModel, ValidationError

from app.core.column_aliases import COLUMN_ALIASES

MAX_EXCEL_SIZE_MB = 20
# Un .xlsx es un zip; openpyxl en read_only sí streamea las filas de la hoja, pero igual
# carga sharedStrings.xml completo en memoria para poder resolver los IDs de string de cada
# celda. Ahí es donde pega un Zip Bomb real: un part que pesa KB comprimido pero se
# descomprime a GB. Se detecta leyendo los tamaños del directorio central del zip (sin
# descomprimir nada) antes de dejar que openpyxl abra el archivo.
MAX_UNCOMPRESSED_MB = 200
MAX_COMPRESSION_RATIO = 100
ModelT = TypeVar("ModelT", bound=BaseModel)

# .xlsx is a zip archive; every real one starts with this signature. Checking it (instead of
# trusting the .xlsx extension alone) is what actually stops a renamed/malicious file from
# reaching the xlsx parser.
XLSX_MAGIC_BYTES = b"PK\x03\x04"


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
    with open(path, "rb") as f:
        header = f.read(len(XLSX_MAGIC_BYTES))
    if header != XLSX_MAGIC_BYTES:
        raise ValueError("El contenido del archivo no es un .xlsx válido (magic bytes no coinciden)")

    try:
        with zipfile.ZipFile(path) as archivo_zip:
            total_uncompressed = sum(info.file_size for info in archivo_zip.infolist())
            total_compressed = sum(info.compress_size for info in archivo_zip.infolist()) or 1
    except zipfile.BadZipFile as exc:
        raise ValueError(f"El archivo no es un zip/.xlsx válido: {exc}") from exc

    if total_uncompressed > MAX_UNCOMPRESSED_MB * 1024 * 1024:
        raise ValueError(
            f"Contenido descomprimido demasiado grande: {total_uncompressed / (1024 * 1024):.2f} MB "
            f"(máximo {MAX_UNCOMPRESSED_MB} MB) -- posible Zip Bomb"
        )
    if total_uncompressed / total_compressed > MAX_COMPRESSION_RATIO:
        raise ValueError(
            f"Ratio de compresión sospechoso ({total_uncompressed / total_compressed:.0f}x, "
            f"máximo {MAX_COMPRESSION_RATIO}x) -- posible Zip Bomb"
        )


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


def validate_rows(df: pd.DataFrame, schema: type[ModelT]) -> tuple[pd.DataFrame, list[str]]:
    """Runs every row through a Pydantic schema (type coercion + required fields). A bad row
    is skipped and reported, not fatal for the rest of the batch (partial success) -- a typo
    in one row of a 500-row Excel shouldn't block every other valid row."""
    validated = []
    errores = []
    for i, row in enumerate(df.to_dict(orient="records")):
        try:
            validated.append(schema(**row).model_dump())
        except ValidationError as exc:
            primer_error = exc.errors()[0]
            campo = ".".join(str(p) for p in primer_error["loc"])
            errores.append(f"Fila {i}: {campo} - {primer_error['msg']}")
    result = pd.DataFrame(validated, columns=list(schema.model_fields.keys()))
    return result, errores


def check_file_freshness(paths: dict[str, Path], max_lag_days: float = 1) -> list[str]:
    """Returns area names whose file is more than max_lag_days older than the most recent one."""
    mtimes = {area: Path(p).stat().st_mtime for area, p in paths.items()}
    newest = max(mtimes.values())
    max_lag_seconds = max_lag_days * 86400
    return [area for area, mtime in mtimes.items() if newest - mtime > max_lag_seconds]
