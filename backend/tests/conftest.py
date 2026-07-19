import os
import time

import pandas as pd
import pytest

from app.core.config import Settings


@pytest.fixture
def tmp_xlsx(tmp_path):
    """Writes a DataFrame to a temp .xlsx and returns its path."""

    def _make(filename: str, df: pd.DataFrame):
        path = tmp_path / filename
        df.to_excel(path, index=False)
        return path

    return _make


def _hoja(ids: list[str]) -> pd.DataFrame:
    return pd.DataFrame(
        {
            "id_muestra": ids,
            "resultado": ["OK"] * len(ids),
            "valor": ["7.2"] * len(ids),
            "tecnico": ["Tec. Pérez"] * len(ids),
            "fecha": ["2026-07-11"] * len(ids),
        }
    )


@pytest.fixture
def lab_dataset(tmp_path):
    """Builds a checklist + multi-sheet Datos.xlsx in a temp dir, covering every dashboard
    scenario in one shot: completo, faltante, prueba fantasma, id con typo y un archivo
    desactualizado. Returns the Settings pointing at it -- no real disk files touched."""
    pd.DataFrame(
        {
            "id_muestra": ["M-001", "M-001", "M-002", "M-002", "M-003"],
            "tipo_analisis": [
                "Agua Potable", "Agua Potable", "Agua Potable", "Agua Potable", "Agua Residual",
            ],
            "prueba_requerida": ["pH", "Metales_Pesados", "pH", "Microbiologia", "pH"],
        }
    ).to_excel(tmp_path / "Checklist_Maestro.xlsx", index=False)

    with pd.ExcelWriter(tmp_path / "Datos.xlsx") as writer:
        # "M-0O2" es un typo del escáner que el matching difuso corrige a "M-002".
        _hoja(["M-001", "M-0O2", "M-003"]).to_excel(writer, sheet_name="pH", index=False)
        _hoja(["M-001"]).to_excel(writer, sheet_name="Metales_Pesados", index=False)
        _hoja(["M-002"]).to_excel(writer, sheet_name="Plaguicidas", index=False)

    stale_time = time.time() - 5 * 86400
    os.utime(tmp_path / "Checklist_Maestro.xlsx", (stale_time, stale_time))

    return Settings(data_dir=tmp_path)
