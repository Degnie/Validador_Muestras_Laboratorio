"""Genera los 4 Excel de ejemplo usados por el MVP. Ejecutar una sola vez (o cuando se
quiera resetear el dataset de demo): python data_mock/generar_datos_mock.py
"""

import os
import time
from pathlib import Path

import pandas as pd

DIR = Path(__file__).parent

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

area1_recepcion = pd.DataFrame(
    {
        "id_muestra": ["M-001", "M-002", "M-003", "M-004", "M-005", "M-006"],
        "cliente": ["Cliente A", "Cliente B", "Cliente C", "Cliente D", "Cliente E", "Cliente F"],
        "fecha_recepcion": ["2026-07-10"] * 6,
    }
)

# M-006 llega con typo (M-0O6) para ejercitar el matching difuso.
# M-004 trae una prueba extra (Plaguicidas) no pedida -> Prueba Fantasma.
# M-003 solo trae pH -> falta Microbiologia.
area2_analisis = pd.DataFrame(
    {
        "id_muestra": [
            "M-001", "M-001", "M-001",
            "M-002", "M-002",
            "M-003",
            "M-004", "M-004", "M-004", "M-004",
            "M-005",
            "M-0O6", "M-0O6",
        ],
        "prueba": [
            "pH", "Metales_Pesados", "Microbiologia",
            "pH", "Metales_Pesados",
            "pH",
            "pH", "Metales_Pesados", "Microbiologia", "Plaguicidas",
            "pH",
            "pH", "Metales_Pesados",
        ],
        "resultado": ["OK"] * 13,
        "fecha_analisis": ["2026-07-11"] * 13,
    }
)

area3_validacion = pd.DataFrame(
    {
        "id_muestra": ["M-001", "M-001", "M-001", "M-002", "M-002", "M-003", "M-005"],
        "prueba": ["pH", "Metales_Pesados", "Microbiologia", "pH", "Metales_Pesados", "pH", "pH"],
        "validado": [True, True, True, True, True, True, True],
    }
)

checklist.to_excel(DIR / "Checklist_Maestro.xlsx", index=False)
area1_recepcion.to_excel(DIR / "Area_1_Recepcion.xlsx", index=False)
area2_analisis.to_excel(DIR / "Area_2_Analisis_Quimico.xlsx", index=False)
area3_validacion.to_excel(DIR / "Area_3_Validacion_Informes.xlsx", index=False)

# Simula desfase: Area_3 se actualizó hace 2 dias, el resto es de "ahora".
stale_time = time.time() - 2 * 86400
os.utime(DIR / "Area_3_Validacion_Informes.xlsx", (stale_time, stale_time))

print("Datos mock generados en", DIR)
