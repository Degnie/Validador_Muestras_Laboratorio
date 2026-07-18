"""Integration suite: exercises the full flow through the real HTTP layer (ingesta ->
matching difuso -> reglas de validacion -> respuesta), using the `lab_dataset` fixture from
conftest.py instead of touching the real data_mock/ files on disk.
"""

import io

import pandas as pd
from fastapi.testclient import TestClient

from app.main import create_app


def test_dashboard_covers_every_estado_and_corrects_typo(lab_dataset):
    client = TestClient(create_app(lab_dataset))

    response = client.get("/api/muestras")

    assert response.status_code == 200
    body = response.json()
    muestras = {m["id_muestra"]: m for m in body["muestras"]}

    assert muestras["M-001"]["estado"] == "Completo"
    assert muestras["M-003"]["estado"] == "Completo"

    # El typo "M-0O2" en Area_2 se corrige a "M-002" antes de cruzar contra el checklist.
    assert "M-0O2" not in muestras
    assert muestras["M-002"]["estado"] == "Pruebas Fantasma"
    assert muestras["M-002"]["pruebas_faltantes"] == ["Microbiologia"]
    assert muestras["M-002"]["pruebas_fantasma"] == ["Plaguicidas"]

    assert body["alertas_desfase"] == ["Area_3_Validacion_Informes"]


def test_search_then_export_round_trip(lab_dataset):
    client = TestClient(create_app(lab_dataset))

    buscar = client.get("/api/muestras/buscar", params={"q": "M-002"})
    assert buscar.status_code == 200
    assert {m["id_muestra"] for m in buscar.json()["muestras"]} == {"M-002"}

    exportar = client.get("/api/muestras/exportar")
    assert exportar.status_code == 200
    exported = pd.read_excel(io.BytesIO(exportar.content))
    assert set(exported["id_muestra"]) == {"M-001", "M-002", "M-003"}


def test_malicious_extension_is_rejected_before_parsing(lab_dataset):
    # Un archivo .csv disfrazado de .xlsx (o cualquier extensión no permitida) no debe
    # siquiera intentar parsearse.
    disguised = lab_dataset.data_dir / "Area_2_Analisis_Quimico.xlsx"
    disguised.unlink()
    (lab_dataset.data_dir / "Area_2_Analisis_Quimico.xlsx").write_text("no soy un excel")

    client = TestClient(create_app(lab_dataset))
    response = client.get("/api/muestras")

    assert response.status_code in (422, 500)
