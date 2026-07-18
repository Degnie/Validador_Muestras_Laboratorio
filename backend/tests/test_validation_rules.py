import pandas as pd

from app.services.validation_rules import build_status


def _checklist():
    return pd.DataFrame(
        {
            "id_muestra": ["M-001", "M-001", "M-002", "M-002", "M-003"],
            "prueba_requerida": ["pH", "Metales_Pesados", "pH", "Microbiologia", "pH"],
        }
    )


def test_status_completo_when_all_required_tests_analyzed():
    checklist = _checklist()
    area2 = pd.DataFrame(
        {
            "id_muestra": ["M-001", "M-001"],
            "prueba": ["pH", "Metales_Pesados"],
        }
    )

    result = build_status(checklist, area2)

    row = result[result["id_muestra"] == "M-001"].iloc[0]
    assert row["estado"] == "Completo"
    assert row["pruebas_faltantes"] == []
    assert row["pruebas_fantasma"] == []


def test_status_faltante_when_required_test_missing():
    checklist = _checklist()
    area2 = pd.DataFrame({"id_muestra": ["M-002"], "prueba": ["pH"]})

    result = build_status(checklist, area2)

    row = result[result["id_muestra"] == "M-002"].iloc[0]
    assert row["estado"] == "Faltante"
    assert row["pruebas_faltantes"] == ["Microbiologia"]


def test_status_pruebas_fantasma_when_extra_test_present():
    checklist = _checklist()
    area2 = pd.DataFrame({"id_muestra": ["M-003", "M-003"], "prueba": ["pH", "Plaguicidas"]})

    result = build_status(checklist, area2)

    row = result[result["id_muestra"] == "M-003"].iloc[0]
    assert row["estado"] == "Pruebas Fantasma"
    assert row["pruebas_fantasma"] == ["Plaguicidas"]


def test_fantasma_takes_priority_over_faltante():
    checklist = _checklist()
    area2 = pd.DataFrame({"id_muestra": ["M-002", "M-002"], "prueba": ["pH", "Plaguicidas"]})

    result = build_status(checklist, area2)

    row = result[result["id_muestra"] == "M-002"].iloc[0]
    assert row["estado"] == "Pruebas Fantasma"
    assert row["pruebas_faltantes"] == ["Microbiologia"]


def test_muestra_with_no_analysis_at_all_is_faltante():
    checklist = _checklist()
    area2 = pd.DataFrame({"id_muestra": [], "prueba": []})

    result = build_status(checklist, area2)

    row = result[result["id_muestra"] == "M-001"].iloc[0]
    assert row["estado"] == "Faltante"
    assert set(row["pruebas_faltantes"]) == {"pH", "Metales_Pesados"}
