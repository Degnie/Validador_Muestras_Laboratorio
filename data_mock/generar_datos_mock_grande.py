"""Genera un dataset de prueba a mayor escala (42 muestras, 100+ filas de análisis,
100+ filas de checklist) para que un técnico de área pueda probar el dashboard real
con volumen realista. No reemplaza `generar_datos_mock.py` (ese sigue siendo el fixture
chico usado como referencia en el README) -- este script pisa los mismos 2 archivos en
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

TIPOS_ANALISIS = ["Agua Potable", "Agua Residual", "Agua de Proceso Industrial"]

TECNICOS = [
    "Tec. Pérez", "Tec. Gómez", "Tec. Ríos", "Tec. Flores", "Tec. Vargas",
]

# Valor literal típico por prueba (unidad incluida), para poblar la columna Valor.
VALORES = {
    "pH": "7.2",
    "Metales_Pesados": "0.02 mg/L",
    "Microbiologia": "<1 UFC/mL",
    "Plaguicidas": "0.01 mg/L",
    "Turbidez": "3.5 NTU",
    "Conductividad": "450 µS/cm",
    "Dureza_Total": "120 mg/L",
    "Cloro_Residual": "0.5 mg/L",
    "Nitratos": "5 mg/L",
    "Solidos_Disueltos": "300 mg/L",
}

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
tipo_analisis_por_muestra = {id_muestra: random.choice(TIPOS_ANALISIS) for id_muestra in muestras}

# ---------- Checklist Maestro: 2-5 pruebas requeridas por muestra ----------
checklist_rows = []
requeridas_por_muestra: dict[str, set[str]] = {}
for id_muestra in muestras:
    requeridas = set(random.sample(TEST_POOL, k=random.randint(2, 5)))
    requeridas_por_muestra[id_muestra] = requeridas
    for prueba in sorted(requeridas):
        checklist_rows.append(
            {
                "id_muestra": id_muestra,
                "tipo_analisis": tipo_analisis_por_muestra[id_muestra],
                "prueba_requerida": prueba,
            }
        )

# ---------- Datos: una pestaña por prueba -- completo / faltante / fantasma / typo ----------
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

filas_por_prueba: dict[str, list[dict]] = {prueba: [] for prueba in TEST_POOL}
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
        analizadas = set(requeridas) - set(random.sample(sorted(requeridas), k=n_quitar))
        if extra_pool:
            analizadas |= set(random.sample(extra_pool, k=n_extra))
    else:  # typo: análisis completo pero con el id_muestra mal escaneado
        analizadas = set(requeridas)
        muestras_con_typo.append(id_muestra)

    id_para_filas = con_typo(id_muestra) if escenario == "typo" else id_muestra
    for prueba in sorted(analizadas):
        filas_por_prueba[prueba].append(
            {
                "ID": id_para_filas,
                "Resultado": "OK",
                "Valor": VALORES[prueba],
                "Tecnico que realizo": random.choice(TECNICOS),
                "Fecha": f"2026-07-{random.randint(11, 16):02d}",
            }
        )

# Dos filas deliberadamente inválidas (en la pestaña "pH"), para ejercitar el descarte parcial
# (validate_rows sigue procesando el resto del lote, ver CHANGELOG 1.5.0).
filas_por_prueba["pH"].append(
    {"ID": None, "Resultado": "OK", "Valor": VALORES["pH"], "Tecnico que realizo": "Tec. Pérez", "Fecha": "2026-07-12"}
)
filas_por_prueba["pH"].append(
    {"ID": "M-999", "Resultado": "x" * 250, "Valor": VALORES["pH"], "Tecnico que realizo": "Tec. Pérez", "Fecha": "2026-07-12"}
)

checklist = pd.DataFrame(checklist_rows)
checklist.to_excel(DIR / "Checklist_Maestro.xlsx", index=False)

with pd.ExcelWriter(DIR / "Datos.xlsx") as writer:
    for prueba, filas in filas_por_prueba.items():
        pd.DataFrame(filas).to_excel(writer, sheet_name=prueba, index=False)

# Simula desfase, igual que generar_datos_mock.py: Checklist_Maestro queda 2 días más viejo.
stale_time = time.time() - 2 * 86400
os.utime(DIR / "Checklist_Maestro.xlsx", (stale_time, stale_time))

print(f"Dataset grande generado en {DIR}")
print(f"  Checklist_Maestro.xlsx -> {len(checklist)} filas ({N_MUESTRAS} muestras)")
print(f"  Datos.xlsx -> {sum(len(f) for f in filas_por_prueba.values())} filas en {len(filas_por_prueba)} pestañas (incluye 2 inválidas a propósito)")
print(f"  Muestras con typo en el ID: {', '.join(muestras_con_typo)}")
