"""Genera un dataset de prueba a mayor escala (42 muestras, 100+ filas de análisis,
100+ filas de checklist) para que un técnico de área pueda probar el dashboard real
con volumen realista. No reemplaza `generar_datos_mock.py` (ese sigue siendo el fixture
chico usado como referencia en el README) -- este script pisa los mismos 4 archivos en
DATA_DIR, así que basta con volver a correr `generar_datos_mock.py` para restaurar el
dataset chico.

Ejecutar desde la raíz del repo: python data_mock/generar_datos_mock_grande.py
"""

import os
import random
import time
from pathlib import Path

import pandas as pd

DIR = Path(__file__).parent
random.seed(42)  # reproducible: correr el script dos veces da el mismo dataset

N_MUESTRAS = 42

TEST_POOL = [
    "pH",
    "Metales_Pesados",
    "Microbiologia",
    "Plaguicidas",
    "Turbidez",
    "Conductividad",
    "Dureza_Total",
    "Cloro_Residual",
    "Nitratos",
    "Solidos_Disueltos",
]

CLIENTES = [
    "Planta Norte", "Agua Andina S.A.", "Consorcio Minero Sur", "Bebidas del Valle",
    "Textil San Martín", "Papelera Central", "Curtiembre Los Andes", "Lácteos La Pradera",
]

# Reemplazo visualmente similar para inyectar typos de escaneo (mismo patrón que
# generar_datos_mock.py usa con M-0O6): edit distance 1, dentro del umbral de
# fuzzy_correct_threshold=80 por defecto.
TYPO_SWAPS = {"0": "O", "1": "I", "5": "S"}


def con_typo(id_muestra: str) -> str:
    for original, reemplazo in TYPO_SWAPS.items():
        if original in id_muestra:
            return id_muestra.replace(original, reemplazo, 1)
    return id_muestra  # sin dígito reemplazable (no debería pasar con IDs M-0NN)


muestras = [f"M-{i:03d}" for i in range(1, N_MUESTRAS + 1)]

# ---------- Checklist Maestro: 2-5 pruebas requeridas por muestra ----------
checklist_rows = []
requeridas_por_muestra: dict[str, set[str]] = {}
for id_muestra in muestras:
    requeridas = set(random.sample(TEST_POOL, k=random.randint(2, 5)))
    requeridas_por_muestra[id_muestra] = requeridas
    for prueba in sorted(requeridas):
        checklist_rows.append({"id_muestra": id_muestra, "prueba_requerida": prueba})

# ---------- Área 1 · Recepción: una fila por muestra ----------
area1_rows = [
    {
        "id_muestra": id_muestra,
        "cliente": random.choice(CLIENTES),
        "fecha_recepcion": f"2026-07-{random.randint(1, 15):02d}",
    }
    for id_muestra in muestras
]

# ---------- Área 2 · Análisis Químico: completo / faltante / fantasma / typo ----------
# Distribución fija (no aleatoria) para poder mostrarle al técnico los 4 escenarios reales
# del negocio en proporciones parejas, en vez de dejarlo librado al azar.
ESCENARIOS = (
    ["completo"] * 16
    + ["faltante"] * 11
    + ["fantasma"] * 10
    + ["ambos"] * 3
    + ["typo"] * 2
)
random.shuffle(ESCENARIOS)

area2_rows = []
muestras_con_typo = []
for id_muestra, escenario in zip(muestras, ESCENARIOS):
    requeridas = requeridas_por_muestra[id_muestra]
    extra_pool = [t for t in TEST_POOL if t not in requeridas]

    if escenario == "completo":
        analizadas = set(requeridas)
    elif escenario == "faltante":
        n_quitar = random.randint(1, max(1, len(requeridas) - 1))
        analizadas = set(requeridas) - set(random.sample(sorted(requeridas), k=n_quitar))
    elif escenario == "fantasma":
        n_extra = random.randint(1, min(2, len(extra_pool))) if extra_pool else 0
        analizadas = set(requeridas) | set(random.sample(extra_pool, k=n_extra))
    elif escenario == "ambos":
        n_quitar = 1
        n_extra = 1 if extra_pool else 0
        analizadas = (set(requeridas) - set(random.sample(sorted(requeridas), k=n_quitar)))
        if extra_pool:
            analizadas |= set(random.sample(extra_pool, k=n_extra))
    else:  # typo: análisis completo pero con el id_muestra mal escaneado
        analizadas = set(requeridas)
        muestras_con_typo.append(id_muestra)

    id_para_filas = con_typo(id_muestra) if escenario == "typo" else id_muestra
    for prueba in sorted(analizadas):
        area2_rows.append(
            {
                "id_muestra": id_para_filas,
                "prueba": prueba,
                "resultado": "OK",
                "fecha_analisis": f"2026-07-{random.randint(11, 16):02d}",
            }
        )

# Dos filas deliberadamente inválidas, para ejercitar el descarte parcial
# (validate_rows sigue procesando el resto del lote, ver CHANGELOG 1.5.0).
area2_rows.append({"id_muestra": None, "prueba": "pH", "resultado": "OK", "fecha_analisis": "2026-07-12"})
area2_rows.append(
    {"id_muestra": "M-999", "prueba": "x" * 250, "resultado": "OK", "fecha_analisis": "2026-07-12"}
)

# ---------- Área 3 · Validación de Informes: ~65% de las muestras ya validadas ----------
area3_rows = []
for id_muestra in muestras:
    if random.random() < 0.65:
        for prueba in sorted(requeridas_por_muestra[id_muestra]):
            area3_rows.append({"id_muestra": id_muestra, "prueba": prueba, "validado": True})

checklist = pd.DataFrame(checklist_rows)
area1_recepcion = pd.DataFrame(area1_rows)
area2_analisis = pd.DataFrame(area2_rows)
area3_validacion = pd.DataFrame(area3_rows)

checklist.to_excel(DIR / "Checklist_Maestro.xlsx", index=False)
area1_recepcion.to_excel(DIR / "Area_1_Recepcion.xlsx", index=False)
area2_analisis.to_excel(DIR / "Area_2_Analisis_Quimico.xlsx", index=False)
area3_validacion.to_excel(DIR / "Area_3_Validacion_Informes.xlsx", index=False)

# Simula desfase, igual que generar_datos_mock.py: Area_3 queda 2 días más vieja.
stale_time = time.time() - 2 * 86400
os.utime(DIR / "Area_3_Validacion_Informes.xlsx", (stale_time, stale_time))

print(f"Dataset grande generado en {DIR}")
print(f"  Checklist_Maestro.xlsx      -> {len(checklist)} filas ({N_MUESTRAS} muestras)")
print(f"  Area_1_Recepcion.xlsx       -> {len(area1_recepcion)} filas")
print(f"  Area_2_Analisis_Quimico.xlsx -> {len(area2_analisis)} filas (incluye 2 inválidas a propósito)")
print(f"  Area_3_Validacion_Informes.xlsx -> {len(area3_validacion)} filas")
print(f"  Muestras con typo en el ID (Área 2): {', '.join(muestras_con_typo)}")
