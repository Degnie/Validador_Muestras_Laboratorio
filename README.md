[PROYECTO LIBRE]

# Validador Centralizado de Muestras de Laboratorio

MVP "read-only" para reducir el tiempo de verificación manual en el área final
de un laboratorio. Ingesta un Excel multipestaña (`Datos.xlsx`, una pestaña
por prueba/área) y un Checklist Maestro (que además indica el tipo de
análisis solicitado por muestra), los cruza y muestra un dashboard con el
estado de cada muestra: **Completo**, **Faltante** o **Pruebas Fantasma**
(pruebas registradas que nadie pidió).

También corrige errores tipográficos en los IDs de muestra mediante búsqueda
difusa (ej. `M-0O6` → `M-006`) y avisa cuando alguno de los 2 Excel de origen
está desactualizado respecto al otro.

Cada muestra es expandible en el dashboard para ver el detalle prueba por
prueba (resultado, técnico, fecha) comparado contra lo exigido por el
Checklist. El usuario puede añadir una muestra incompleta a una **Lista de
Vigilancia** (persistida en el navegador); cuando una prueba faltante de una
muestra vigilada se completa en una actualización posterior, aparece una
notificación en el buzón local y queda un registro de auditoría en
`data_mock/historial_notificaciones.csv`.

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

### Con Docker

```bash
cp .env.example .env   # ajustar puertos/DATA_DIR si hace falta
docker compose up --build
```

Backend en `:8000` (Gunicorn + Uvicorn workers, usuario sin privilegios) y frontend en
`:5173` (Nginx sirviendo el build de Vite, también sin privilegios, con proxy interno de
`/api` hacia el backend). Ambos `Dockerfile` son multi-etapa: la imagen final no incluye
tests, `venv`/`node_modules` de desarrollo ni herramientas de build.

> **Pendiente:** en esta máquina Docker requiere activar la virtualización
> (VT-x/AMD-V) en la BIOS, lo que implica reiniciar. Queda pospuesto — mientras
> tanto, backend y frontend se corren en local sin Docker (ver secciones de
> arriba), que no dependen de él.

## Notas de compatibilidad

Este entorno corre Python 3.14. `pandas`, `fastapi` y `pydantic` están
fijados en `backend/requirements.txt` a las versiones mínimas que publican
wheel precompilado para `cp314` en Windows — versiones más viejas (p. ej.
`pandas==2.2.3`, `pydantic==2.10.4`) intentan compilar desde código fuente y
fallan por falta de toolchain de compilación (MSVC/Rust) en esta máquina. Se
omitió `python-Levenshtein` (acelerador clásico de `thefuzz`, sin wheel para
3.14): no hizo falta reemplazarlo, porque `thefuzz==0.22.1` ya delega
internamente en [`rapidfuzz`](https://github.com/rapidfuzz/RapidFuzz) (C++,
vectorizado), que sí publica wheel para 3.14 — quedó fijado explícito en
`requirements.txt` para dejar esa dependencia real a la vista.
