from dataclasses import dataclass
from typing import Protocol

import pandas as pd


@dataclass(frozen=True)
class ContextoMuestra:
    id_muestra: str
    requeridas: set[str]
    analizadas: set[str]

    @property
    def faltantes(self) -> list[str]:
        return sorted(self.requeridas - self.analizadas)

    @property
    def fantasma(self) -> list[str]:
        return sorted(self.analizadas - self.requeridas)


class ReglaValidacion(Protocol):
    """Un eslabón de la cadena: decide el estado de una muestra o delega (None) a la
    siguiente regla. Agregar una regla de laboratorio nueva es agregar una clase con este
    método e insertarla en la lista, sin tocar las reglas existentes."""

    def evaluar(self, contexto: ContextoMuestra) -> str | None: ...


class ReglaPruebasFantasma:
    def evaluar(self, contexto: ContextoMuestra) -> str | None:
        return "Pruebas Fantasma" if contexto.fantasma else None


class ReglaPruebasFaltantes:
    def evaluar(self, contexto: ContextoMuestra) -> str | None:
        return "Faltante" if contexto.faltantes else None


class ReglaCompleto:
    def evaluar(self, contexto: ContextoMuestra) -> str | None:
        return "Completo"


# Orden = prioridad: fantasma se marca aunque también falten pruebas, y "Completo" es el
# fallback final que siempre resuelve (por eso debe ir último en cualquier cadena custom).
REGLAS_POR_DEFECTO: list[ReglaValidacion] = [
    ReglaPruebasFantasma(),
    ReglaPruebasFaltantes(),
    ReglaCompleto(),
]


def _evaluar_estado(contexto: ContextoMuestra, reglas: list[ReglaValidacion]) -> str:
    for regla in reglas:
        estado = regla.evaluar(contexto)
        if estado is not None:
            return estado
    raise ValueError(
        f"Ninguna regla determinó un estado para {contexto.id_muestra}: "
        "la cadena debe terminar en una regla que siempre resuelva (ej. ReglaCompleto)."
    )


def build_status(
    checklist: pd.DataFrame,
    datos: pd.DataFrame,
    reglas: list[ReglaValidacion] | None = None,
) -> pd.DataFrame:
    """Cross-references required tests (checklist, per tipo_analisis) against tests actually
    performed (datos: una fila por prueba/pestaña, con resultado/tecnico/fecha)."""
    reglas = reglas if reglas is not None else REGLAS_POR_DEFECTO
    rows = []
    for id_muestra, grupo in checklist.groupby("id_muestra"):
        required = grupo["prueba_requerida"]
        tipo_analisis = grupo["tipo_analisis"].iloc[0]
        filas_datos = datos.loc[datos["id_muestra"] == id_muestra]
        analizadas = set(filas_datos["prueba"])
        contexto = ContextoMuestra(id_muestra=id_muestra, requeridas=set(required), analizadas=analizadas)

        rows.append(
            {
                "id_muestra": id_muestra,
                "estado": _evaluar_estado(contexto, reglas),
                "tipo_analisis": tipo_analisis,
                "pruebas_faltantes": contexto.faltantes,
                "pruebas_fantasma": contexto.fantasma,
                "pruebas": [
                    {
                        "nombre_prueba": fila["prueba"],
                        "resultado": fila["resultado"],
                        "valor": fila["valor"],
                        "tecnico": fila["tecnico"],
                        "fecha": fila["fecha"],
                    }
                    for fila in filas_datos.to_dict(orient="records")
                ],
            }
        )

    return pd.DataFrame(rows)
