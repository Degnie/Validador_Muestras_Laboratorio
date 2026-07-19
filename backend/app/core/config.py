import os
from pathlib import Path

from pydantic import BaseModel, Field

DEFAULT_DATA_DIR = Path(__file__).resolve().parent.parent.parent.parent / "data_mock"


class Settings(BaseModel):
    data_dir: Path = Field(default_factory=lambda: Path(os.environ.get("DATA_DIR", DEFAULT_DATA_DIR)))
    # Umbrales de thefuzz (0-100): antes hardcodeados en fuzzy_match.py, movidos acá para
    # poder ajustarlos por entorno (env var) o en tests sin tocar el servicio.
    fuzzy_correct_threshold: int = Field(
        default_factory=lambda: int(os.environ.get("FUZZY_CORRECT_THRESHOLD", 80))
    )
    fuzzy_search_threshold: int = Field(
        default_factory=lambda: int(os.environ.get("FUZZY_SEARCH_THRESHOLD", 75))
    )

    @property
    def checklist_path(self) -> Path:
        return self.data_dir / "Checklist_Maestro.xlsx"

    @property
    def datos_path(self) -> Path:
        return self.data_dir / "Datos.xlsx"

    @property
    def notificaciones_csv_path(self) -> Path:
        return self.data_dir / "historial_notificaciones.csv"

    @property
    def source_paths(self) -> dict[str, Path]:
        return {"Datos": self.datos_path, "Checklist_Maestro": self.checklist_path}
