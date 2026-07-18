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


def test_get_muestras_rejects_checklist_with_missing_required_column(tmp_path):
    _write_dataset(tmp_path)
    pd.DataFrame({"id_muestra": ["M-001"], "prueba_requerida": [None]}).to_excel(
        tmp_path / "Checklist_Maestro.xlsx", index=False
    )
    app = create_app(Settings(data_dir=tmp_path))
    client = TestClient(app)

    response = client.get("/api/muestras")

    assert response.status_code == 422


def test_buscar_returns_only_matching_codes(tmp_path):
    _write_dataset(tmp_path)
    pd.DataFrame(
        {
            "id_muestra": ["M-001", "M-001", "M-777", "M-777"],
            "prueba_requerida": ["pH", "Metales_Pesados", "pH", "Metales_Pesados"],
        }
    ).to_excel(tmp_path / "Checklist_Maestro.xlsx", index=False)
    app = create_app(Settings(data_dir=tmp_path))
    client = TestClient(app)

    response = client.get("/api/muestras/buscar", params={"q": "M-001"})

    assert response.status_code == 200
    ids = {m["id_muestra"] for m in response.json()["muestras"]}
    assert ids == {"M-001"}


def test_buscar_with_blank_query_returns_no_results(tmp_path):
    _write_dataset(tmp_path)
    app = create_app(Settings(data_dir=tmp_path))
    client = TestClient(app)

    response = client.get("/api/muestras/buscar", params={"q": ""})

    assert response.status_code == 200
    assert response.json()["muestras"] == []


def test_exportar_returns_a_readable_xlsx(tmp_path):
    _write_dataset(tmp_path)
    app = create_app(Settings(data_dir=tmp_path))
    client = TestClient(app)

    response = client.get("/api/muestras/exportar")

    assert response.status_code == 200
    assert (
        response.headers["content-type"]
        == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )
    import io

    exported = pd.read_excel(io.BytesIO(response.content))
    assert "id_muestra" in exported.columns
    assert "M-001" in exported["id_muestra"].values
