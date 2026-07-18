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


@pytest.fixture
def lab_dataset(tmp_path):
    """Builds a full 4-file dataset (checklist + 3 areas) in a temp dir, covering every
    dashboard scenario in one shot: completo, faltante, prueba fantasma, id con typo y un
    archivo desactualizado. Returns the Settings pointing at it -- no real disk files touched."""
    pd.DataFrame(
        {
            "id_muestra": ["M-001", "M-001", "M-002", "M-002", "M-003"],
            "prueba_requerida": ["pH", "Metales_Pesados", "pH", "Microbiologia", "pH"],
        }
    ).to_excel(tmp_path / "Checklist_Maestro.xlsx", index=False)

    pd.DataFrame(
        {"id_muestra": ["M-001", "M-002", "M-003"], "cliente": ["A", "B", "C"]}
    ).to_excel(tmp_path / "Area_1_Recepcion.xlsx", index=False)

    pd.DataFrame(
        {
            "id_muestra": ["M-001", "M-001", "M-0O2", "M-002", "M-003", "M-003"],
            "prueba": ["pH", "Metales_Pesados", "pH", "Plaguicidas", "pH", "pH"],
        }
    ).to_excel(tmp_path / "Area_2_Analisis_Quimico.xlsx", index=False)

    pd.DataFrame(
        {"id_muestra": ["M-001", "M-001"], "prueba": ["pH", "Metales_Pesados"], "validado": [True, True]}
    ).to_excel(tmp_path / "Area_3_Validacion_Informes.xlsx", index=False)

    stale_time = time.time() - 5 * 86400
    os.utime(tmp_path / "Area_3_Validacion_Informes.xlsx", (stale_time, stale_time))

    return Settings(data_dir=tmp_path)
