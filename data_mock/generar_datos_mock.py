"""Genera los 2 Excel de ejemplo usados por el MVP. Ejecutar una sola vez (o cuando se
quiera resetear el dataset de demo): python data_mock/generar_datos_mock.py
"""

import os
import time
from pathlib import Path

import pandas as pd

DIR = Path(__file__).parent

# Checklist Maestro: por muestra, el tipo de análisis solicitado y las pruebas que ese tipo
# exige. La misma tabla que antes, con tipo_analisis agregado.
checklist = pd.DataFrame(
    {
        "id_muestra": [
            "M-001", "M-001", "M-001",
            "M-002", "M-002",
            "M-003", "M-003",
            "M-004", "M-004", "M-004",
            "M-005",
            "M-006", "M-006",
        ],
        "tipo_analisis": [
            "Agua Potable", "Agua Potable", "Agua Potable",
            "Agua Potable", "Agua Potable",
            "Agua Residual", "Agua Residual",
            "Agua Residual", "Agua Residual", "Agua Residual",
            "Agua Potable",
            "Agua Residual", "Agua Residual",
        ],
        "prueba_requerida": [
            "pH", "Metales_Pesados", "Microbiologia",
            "pH", "Metales_Pesados",
            "pH", "Microbiologia",
            "pH", "Metales_Pesados", "Microbiologia",
            "pH",
            "pH", "Metales_Pesados",
        ],
    }
)

# Datos.xlsx: una pestaña por prueba (antes eran filas de Area_2 con una columna "prueba").
# M-006 llega con typo (M-0O6) para ejercitar el matching difuso.
# M-004 trae Plaguicidas extra (no pedida) -> Prueba Fantasma.
# M-003 no tiene fila en Microbiologia -> falta esa prueba.
TECNICOS = ["Tec. Pérez", "Tec. Gómez", "Tec. Ríos"]

# Valor literal típico por prueba (unidad incluida), para poblar la columna Valor.
VALORES = {
    "pH": "7.2",
    "Metales_Pesados": "0.02 mg/L",
    "Microbiologia": "<1 UFC/mL",
    "Plaguicidas": "0.01 mg/L",
}


def _hoja(ids: list[str], prueba: str) -> pd.DataFrame:
    return pd.DataFrame(
        {
            "ID": ids,
            "Resultado": ["OK"] * len(ids),
            "Valor": [VALORES[prueba]] * len(ids),
            "Tecnico que realizo": [TECNICOS[i % len(TECNICOS)] for i in range(len(ids))],
            "Fecha": ["2026-07-11"] * len(ids),
        }
    )


hojas = {
    "pH": _hoja(["M-001", "M-002", "M-003", "M-004", "M-005", "M-0O6"], "pH"),
    "Metales_Pesados": _hoja(["M-001", "M-002", "M-004", "M-0O6"], "Metales_Pesados"),
    "Microbiologia": _hoja(["M-001", "M-004"], "Microbiologia"),
    "Plaguicidas": _hoja(["M-004"], "Plaguicidas"),
}

checklist.to_excel(DIR / "Checklist_Maestro.xlsx", index=False)
with pd.ExcelWriter(DIR / "Datos.xlsx") as writer:
    for nombre_hoja, df in hojas.items():
        df.to_excel(writer, sheet_name=nombre_hoja, index=False)

# Simula desfase: Checklist_Maestro se actualizó hace 2 dias, Datos es de "ahora".
stale_time = time.time() - 2 * 86400
os.utime(DIR / "Checklist_Maestro.xlsx", (stale_time, stale_time))

print("Datos mock generados en", DIR)
