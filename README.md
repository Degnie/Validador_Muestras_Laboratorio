[PROYECTO LIBRE]

# Validador Centralizado de Muestras de Laboratorio

MVP "read-only" para reducir el tiempo de verificación manual en el área final
de un laboratorio. Ingesta los Excel que hoy usan las tres áreas del proceso
(Recepción, Análisis Químico, Validación de Informes), los cruza contra un
Checklist Maestro y muestra un dashboard con el estado de cada muestra:
**Completo**, **Faltante** o **Pruebas Fantasma** (pruebas registradas que
nadie pidió).

También corrige errores tipográficos en los IDs de muestra mediante búsqueda
difusa (ej. `M-0O6` → `M-006`) y avisa cuando alguno de los Excel de origen
está desactualizado respecto a los demás.

## Stack

- **Backend:** FastAPI + Pandas + TheFuzz (ver [ADR-001](docs/ADR-001-Stack-Tecnologico.md))
- **Frontend:** React + TypeScript + Vite

## Estructura

```
data_mock/    Excel de ejemplo + script generador
backend/      API FastAPI (TDD: pytest en backend/tests)
frontend/     Dashboard React (TDD: vitest en frontend/tests)
docs/         ADRs
```

## Cómo correrlo

### Backend

```bash
cd backend
python -m venv venv
./venv/Scripts/pip install -r requirements.txt   # Windows
python data_mock/generar_datos_mock.py            # (re)genera el dataset de ejemplo, desde la raíz del repo
./venv/Scripts/python -m uvicorn app.main:app --reload --port 8000
```

Tests: `./venv/Scripts/python -m pytest`

### Frontend

```bash
cd frontend
npm install
npm run dev   # sirve en :5173, con proxy a la API en :8000
```

Tests: `npm test`

## Notas de compatibilidad

Este entorno corre Python 3.14. `pandas`, `fastapi` y `pydantic` están
fijados en `backend/requirements.txt` a las versiones mínimas que publican
wheel precompilado para `cp314` en Windows — versiones más viejas (p. ej.
`pandas==2.2.3`, `pydantic==2.10.4`) intentan compilar desde código fuente y
fallan por falta de toolchain de compilación (MSVC/Rust) en esta máquina. Se
omitió `python-Levenshtein` (acelerador opcional de `thefuzz`, tampoco tiene
wheel para 3.14): `thefuzz` cae a su implementación en Python puro, que
alcanza de sobra para el volumen de datos de este MVP.
