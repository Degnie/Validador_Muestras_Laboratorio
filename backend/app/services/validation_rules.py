import pandas as pd


def build_status(checklist: pd.DataFrame, area2: pd.DataFrame) -> pd.DataFrame:
    """Cross-references required tests (checklist) against tests actually analyzed (area2)."""
    rows = []
    for id_muestra, required in checklist.groupby("id_muestra")["prueba_requerida"]:
        required_set = set(required)
        analyzed_set = set(area2.loc[area2["id_muestra"] == id_muestra, "prueba"])

        faltantes = sorted(required_set - analyzed_set)
        fantasma = sorted(analyzed_set - required_set)

        if fantasma:
            estado = "Pruebas Fantasma"
        elif faltantes:
            estado = "Faltante"
        else:
            estado = "Completo"

        rows.append(
            {
                "id_muestra": id_muestra,
                "estado": estado,
                "pruebas_faltantes": faltantes,
                "pruebas_fantasma": fantasma,
            }
        )

    return pd.DataFrame(rows)
