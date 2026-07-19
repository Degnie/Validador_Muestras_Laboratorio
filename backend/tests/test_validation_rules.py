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
            "tipo_analisis": ["Agua Potable"] * 4 + ["Agua Residual"],
            "prueba_requerida": ["pH", "Metales_Pesados", "pH", "Microbiologia", "pH"],
        }
    )


def _datos(ids: list[str], pruebas: list[str]) -> pd.DataFrame:
    return pd.DataFrame(
        {
            "id_muestra": ids,
            "prueba": pruebas,
            "resultado": ["OK"] * len(ids),
            "valor": ["7.2"] * len(ids),
            "tecnico": ["Tec. Pérez"] * len(ids),
            "fecha": ["2026-07-11"] * len(ids),
        }
    )


def test_status_completo_when_all_required_tests_analyzed():
    checklist = _checklist()
    datos = _datos(["M-001", "M-001"], ["pH", "Metales_Pesados"])

    result = build_status(checklist, datos)

    row = result[result["id_muestra"] == "M-001"].iloc[0]
    assert row["estado"] == "Completo"
    assert row["tipo_analisis"] == "Agua Potable"
    assert row["pruebas_faltantes"] == []
    assert row["pruebas_fantasma"] == []
    assert row["pruebas"] == [
        {"nombre_prueba": "pH", "resultado": "OK", "valor": "7.2", "tecnico": "Tec. Pérez", "fecha": "2026-07-11"},
        {
            "nombre_prueba": "Metales_Pesados",
            "resultado": "OK",
            "valor": "7.2",
            "tecnico": "Tec. Pérez",
            "fecha": "2026-07-11",
        },
    ]


def test_status_faltante_when_required_test_missing():
    checklist = _checklist()
    datos = _datos(["M-002"], ["pH"])

    result = build_status(checklist, datos)

    row = result[result["id_muestra"] == "M-002"].iloc[0]
    assert row["estado"] == "Faltante"
    assert row["pruebas_faltantes"] == ["Microbiologia"]


def test_status_pruebas_fantasma_when_extra_test_present():
    checklist = _checklist()
    datos = _datos(["M-003", "M-003"], ["pH", "Plaguicidas"])

    result = build_status(checklist, datos)

    row = result[result["id_muestra"] == "M-003"].iloc[0]
    assert row["estado"] == "Pruebas Fantasma"
    assert row["pruebas_fantasma"] == ["Plaguicidas"]


def test_fantasma_takes_priority_over_faltante():
    checklist = _checklist()
    datos = _datos(["M-002", "M-002"], ["pH", "Plaguicidas"])

    result = build_status(checklist, datos)

    row = result[result["id_muestra"] == "M-002"].iloc[0]
    assert row["estado"] == "Pruebas Fantasma"
    assert row["pruebas_faltantes"] == ["Microbiologia"]


def test_muestra_with_no_analysis_at_all_is_faltante():
    checklist = _checklist()
    datos = _datos([], [])

    result = build_status(checklist, datos)

    row = result[result["id_muestra"] == "M-001"].iloc[0]
    assert row["estado"] == "Faltante"
    assert set(row["pruebas_faltantes"]) == {"pH", "Metales_Pesados"}
    assert row["pruebas"] == []


class _ReglaMarcarM003ComoUrgente:
    """Regla de ejemplo: demuestra que se puede insertar una regla nueva sin tocar las
    existentes, con más prioridad que las reglas por defecto."""

    def evaluar(self, contexto: ContextoMuestra) -> str | None:
        return "Urgente" if contexto.id_muestra == "M-003" else None


def test_custom_rule_chain_can_be_injected_without_touching_default_rules():
    checklist = _checklist()
    datos = _datos(["M-003"], ["pH"])
    reglas_personalizadas = [_ReglaMarcarM003ComoUrgente(), *REGLAS_POR_DEFECTO]

    result = build_status(checklist, datos, reglas=reglas_personalizadas)

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
