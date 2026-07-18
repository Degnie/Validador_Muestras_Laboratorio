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
    def area1_path(self) -> Path:
        return self.data_dir / "Area_1_Recepcion.xlsx"

    @property
    def area2_path(self) -> Path:
        return self.data_dir / "Area_2_Analisis_Quimico.xlsx"

    @property
    def area3_path(self) -> Path:
        return self.data_dir / "Area_3_Validacion_Informes.xlsx"

    @property
    def area_paths(self) -> dict[str, Path]:
        return {
            "Area_1_Recepcion": self.area1_path,
            "Area_2_Analisis_Quimico": self.area2_path,
            "Area_3_Validacion_Informes": self.area3_path,
        }
