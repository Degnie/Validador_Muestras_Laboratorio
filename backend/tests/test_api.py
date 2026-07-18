import pandas as pd
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.main import create_app


def _write_dataset(dir_path):
    pd.DataFrame(
        {"id_muestra": ["M-001", "M-001"], "prueba_requerida": ["pH", "Metales_Pesados"]}
    ).to_excel(dir_path / "Checklist_Maestro.xlsx", index=False)
    pd.DataFrame({"id_muestra": ["M-001"], "cliente": ["Cliente A"]}).to_excel(
        dir_path / "Area_1_Recepcion.xlsx", index=False
    )
    pd.DataFrame({"id_muestra": ["M-0O1"], "prueba": ["pH"]}).to_excel(
        dir_path / "Area_2_Analisis_Quimico.xlsx", index=False
    )
    pd.DataFrame({"id_muestra": ["M-001"], "prueba": ["pH"], "validado": [True]}).to_excel(
        dir_path / "Area_3_Validacion_Informes.xlsx", index=False
    )


def test_get_muestras_returns_status_with_fuzzy_matched_id(tmp_path):
    _write_dataset(tmp_path)
    app = create_app(Settings(data_dir=tmp_path))
    client = TestClient(app)

    response = client.get("/api/muestras")

    assert response.status_code == 200
    body = response.json()
    muestras = {m["id_muestra"]: m for m in body["muestras"]}
    assert muestras["M-001"]["estado"] == "Faltante"
    assert muestras["M-001"]["pruebas_faltantes"] == ["Metales_Pesados"]
