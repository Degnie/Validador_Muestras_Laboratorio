import pandas as pd

from app.services.validation_rules import (
    REGLAS_POR_DEFECTO,
    ContextoMuestra,
    ReglaPruebasFantasma,
    build_status,
)


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


class _ReglaMarcarM003ComoUrgente:
    """Regla de ejemplo: demuestra que se puede insertar una regla nueva sin tocar las
    existentes, con más prioridad que las reglas por defecto."""

    def evaluar(self, contexto: ContextoMuestra) -> str | None:
        return "Urgente" if contexto.id_muestra == "M-003" else None


def test_custom_rule_chain_can_be_injected_without_touching_default_rules():
    checklist = _checklist()
    area2 = pd.DataFrame({"id_muestra": ["M-003"], "prueba": ["pH"]})
    reglas_personalizadas = [_ReglaMarcarM003ComoUrgente(), *REGLAS_POR_DEFECTO]

    result = build_status(checklist, area2, reglas=reglas_personalizadas)

    row = result[result["id_muestra"] == "M-003"].iloc[0]
    assert row["estado"] == "Urgente"
    # Las demás muestras siguen evaluándose con las reglas por defecto sin cambios.
    otra = result[result["id_muestra"] == "M-001"].iloc[0]
    assert otra["estado"] == "Faltante"


def test_default_rules_use_priority_order_fantasma_then_faltante_then_completo():
    assert [type(r).__name__ for r in REGLAS_POR_DEFECTO] == [
        "ReglaPruebasFantasma",
        "ReglaPruebasFaltantes",
        "ReglaCompleto",
    ]


def test_regla_pruebas_fantasma_returns_none_when_nothing_extra():
    contexto = ContextoMuestra(id_muestra="M-001", requeridas={"pH"}, analizadas={"pH"})

    assert ReglaPruebasFantasma().evaluar(contexto) is None
