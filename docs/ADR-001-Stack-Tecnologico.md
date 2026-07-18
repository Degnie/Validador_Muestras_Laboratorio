# ADR-001: Stack Tecnológico

## Estado

Aceptado.

## Contexto

El laboratorio hoy verifica manualmente, área por área, que cada muestra
tenga todas las pruebas requeridas antes de emitir el informe final. Esa
verificación cruza cuatro fuentes de Excel (Recepción, Análisis Químico,
Validación de Informes y un Checklist Maestro) que pueden tener columnas
renombradas, IDs de muestra con typos, y desfases de actualización entre
archivos. El objetivo de este MVP es automatizar ese cruce en un dashboard
de solo lectura, sin tocar los procesos ni los Excel originales.

## Decisión

- **Backend: FastAPI (Python).** Expone la API de forma asíncrona y con
  tipado (Pydantic) sin el boilerplate de otros frameworks. Python es
  también el lenguaje natural para el punto siguiente.
- **Procesamiento de datos: Pandas + TheFuzz.** Pandas es la herramienta
  estándar para leer, normalizar y cruzar múltiples DataFrames de Excel
  (manejo de columnas alteradas, tipos, valores faltantes). TheFuzz aporta
  la búsqueda difusa necesaria para tolerar errores tipográficos en los IDs
  de muestra al cruzarlos contra el Checklist Maestro.
- **Frontend: React + TypeScript + Vite.** Separar el dashboard del backend
  permite iterar la UI (tabla de estados, alertas de desfase) sin redeploy
  del servicio de datos, y el tipado compartido (los mismos campos que
  expone la API) reduce errores de integración. Vite da un ciclo de
  desarrollo rápido para un proyecto de este tamaño.
- **Separación frontend/backend** en vez de un monolito (p. ej. Flask +
  Jinja) porque el dashboard necesita refrescos frecuentes e interactividad
  (filtros, alertas) que un enfoque de solo plantillas server-side haría
  más rígido, y porque escala mejor si más adelante se agregan más
  vistas o consumidores de la misma API.

## Consecuencias

- Dos procesos a correr en desarrollo (API en `:8000`, Vite en `:5173`),
  mitigado con el proxy de Vite hacia `/api`.
- Python 3.14 (versión instalada en esta máquina) no tiene wheels
  precompilados para las versiones "clásicas" fijadas originalmente
  (`pandas==2.2.3`, `pydantic==2.10.4`) y no hay toolchain de compilación
  (MSVC/Rust) disponible para compilarlas desde código fuente. Se resolvió
  subiendo esas dependencias a las primeras versiones que sí publican wheel
  para `cp314` (`pandas==3.0.3`, `pydantic==2.13.4`, `fastapi==0.121.2`) y
  omitiendo `python-Levenshtein` (acelerador clásico de `thefuzz` sin
  wheel para 3.14). Corrección posterior: no hizo falta que `thefuzz`
  cayera a Python puro — desde la 0.20, `thefuzz` delega internamente en
  `rapidfuzz` (C++, vectorizado con SIMD), que sí tiene wheel para 3.14. La
  búsqueda difusa y por código ya corre acelerada sin ningún cambio de
  código; solo se fijó `rapidfuzz` explícito en `requirements.txt` para que
  esa dependencia real deje de estar oculta detrás de `thefuzz`. El stack
  elegido (React + FastAPI + Pandas) no cambió.

## Hardening de seguridad, resiliencia y contenedores (implementado)

Puntos que rondas sucesivas de auditoría suelen volver a pedir. Ya están
resueltos dentro del stack de la sección "Decisión" (sin ORM, sin cola de
mensajes, sin base de datos nueva); esta sección es la referencia rápida
para no reabrirlos sin revisar antes el código y el `CHANGELOG.md`.

- **Ingesta resiliente a memoria y a filas rotas**: `read_excel_normalized`
  (`backend/app/services/ingestion.py`) usa `openpyxl` en modo `read_only`
  y arma el `DataFrame` por lotes (`batch_size`), sin cargar el workbook
  completo en memoria — desde 1.1.0. `validate_rows` es *partial success*
  desde 1.5.0: una fila que no pasa el schema Pydantic se descarta y se
  reporta en `DashboardResponse.errores_validacion`, sin abortar el resto
  del lote; solo un archivo completo ilegible (extensión falsa, magic
  bytes, Zip Bomb, zip corrupto) sigue devolviendo 422.
- **Sanitización de excepciones**: `sanitized_error_handler`
  (`backend/app/main.py`, `@app.exception_handler(Exception)`) captura todo
  error no controlado, lo loguea server-side y devuelve siempre
  `{"detail": "Error interno del servidor"}` con 500 — nunca el mensaje ni
  el traceback real. Vigente desde 1.1.0.
- **Umbrales de fuzzy matching parametrizados**: `fuzzy_correct_threshold` /
  `fuzzy_search_threshold` viven en `backend/app/core/config.py`
  (override por `FUZZY_CORRECT_THRESHOLD` / `FUZZY_SEARCH_THRESHOLD`) e
  inyectados en `correct_ids`/`search_by_code` desde `api/muestras.py`.
  Desde 1.5.0.
- **Contenedores de mínimo privilegio**: `backend/Dockerfile` corre como
  `appuser` (no root) y sirve con `gunicorn -k uvicorn.workers.UvicornWorker`
  (servidor de producción, no `uvicorn --reload`). `frontend/Dockerfile` es
  multi-stage (build en `node:20-slim`, se sirve con
  `nginxinc/nginx-unprivileged:alpine`, puerto 8080 sin root). Vigente
  desde 1.1.0.
- **Cabeceras de seguridad y CSP**: `SecurityHeadersMiddleware`
  (`backend/app/core/middleware.py`) agrega HSTS, `X-Content-Type-Options`,
  `X-Frame-Options` y `Referrer-Policy` a toda respuesta de la API;
  `frontend/nginx.conf` agrega el mismo set más `Content-Security-Policy`
  (`default-src 'self'`) a las respuestas estáticas. Vigente desde 1.2.0
  (backend) / 1.2.0 (nginx).
- **Límites de payload y rate limiting**: `MaxBodySizeMiddleware` (413 si
  `Content-Length` > 1 MB) y `RateLimitMiddleware` (429 + `Retry-After`,
  ventana deslizante en memoria por IP) en `backend/app/core/middleware.py`.
  Vigente desde 1.1.0 (body size) / 1.2.0 (rate limit).
- **Cancelación de requests obsoletas (race conditions) en el frontend**:
  `fetchDashboard`/`exportDashboard` (`frontend/src/services/api.ts`)
  aceptan un `AbortSignal`; `DashboardPage` usa el `signal` que la propia
  `queryFn` de TanStack Query inyecta y aborta automáticamente cuando
  `debouncedQuery` cambia (input con `useDebounce`) o el componente se
  desmonta, en vez de un `AbortController` manual. Vigente desde 1.3.0.
- **Interceptor centralizado de errores HTTP en el frontend**: `fetchJson`
  + la clase `ApiError` (`api.ts`) traducen todo `4xx`/`5xx` y toda falla de
  red a un tipo único con `friendlyMessage`, consumido por `Dashboard.tsx`
  como banner. `ErrorBoundary.tsx` es la red aparte para errores de
  *render* de React (no HTTP), no un reemplazo del interceptor. Vigente
  desde 1.1.0 (interceptor) / 1.2.0 (`ErrorBoundary`).
- **Descarga de reportes sin bloquear el hilo principal**: `exportDashboard`
  ya resuelve el archivo como `Blob` vía `response.blob()` (asíncrono);
  `triggerDownload` (`frontend/src/utils/download.ts`) solo crea el
  `<a download>` temporario y dispara el click — no hay parsing ni
  transformación de datos ahí que justifique mover trabajo a un Web
  Worker para el volumen de filas que maneja esta app.
- **Límite de memoria del contenedor backend**: `docker-compose.yml` fija
  `deploy.resources.limits.memory: 512M` en el servicio `backend`, para
  que un archivo cercano al límite de ingesta no se lleve puesta la
  máquina host — complementa (no reemplaza) el streaming por lotes de
  `ingestion.py`. Vigente desde la iteración "Unreleased" post-1.5.0.
- **Sanitización de input en la búsqueda difusa**: `search_by_code`
  (`backend/app/services/fuzzy_match.py`) limpia caracteres de control y
  trunca a 200 caracteres el `q` de la request antes de tocar
  `thefuzz`/`rapidfuzz`. `thefuzz` nunca interpreta el input como patrón
  (sin superficie de inyección tipo regex/SQL); es defensa en profundidad
  contra input adversarial u oversized, no el cierre de una vulnerabilidad
  previa. Vigente desde la iteración "Unreleased" post-1.5.0.
- **`backend/Dockerfile` se queda en `python:3.12-slim`, no Alpine/distroless**:
  evaluado y descartado. `pandas`/`numpy` no publican wheels para musl
  (base de Alpine), lo que forzaría compilarlos desde código fuente dentro
  del build — el mismo tipo de problema de disponibilidad de wheels que ya
  obligó a fijar versiones más nuevas para Python 3.14 (ver "Consecuencias"
  arriba). `slim` ya es multi-stage y corre sin root (`appuser`); Alpine no
  resuelve una superficie de ataque adicional relevante para este caso.
  Reiterado (rechazado por segunda vez) sin cambios en la iteración
  "Unreleased" post-1.5.0-b.
- **Límite de memoria parametrizable por entorno**: `docker-compose.yml`
  usa `deploy.resources.limits.memory: ${BACKEND_MEM_LIMIT:-512M}` (con
  `BACKEND_MEM_LIMIT=512M` documentado en `.env.example`), en vez del
  valor fijo `512M` de la iteración anterior — mismo mecanismo que
  `DATA_DIR`/`BACKEND_PORT`/`FRONTEND_PORT`, sin infraestructura nueva.
- **Workers de Gunicorn parametrizados y acotados por memoria**: el `CMD`
  de `backend/Dockerfile` pasa a forma shell
  (`sh -c "exec gunicorn ... -w ${WEB_CONCURRENCY:-1} --max-requests 1000"`)
  para poder expandir `${WEB_CONCURRENCY:-1}` en runtime (la forma exec de
  array no expande variables de entorno); `exec` reemplaza el proceso de
  `sh` por `gunicorn`, que sigue siendo PID 1 y recibe las señales de
  Docker sin la capa de shell de por medio. `WEB_CONCURRENCY=1` por
  defecto (parametrizable en `docker-compose.yml`/`.env.example`) es
  deliberado: cada request de `/api/muestras` es CPU-bound (fuzzy
  matching) y mantiene varios `DataFrame` de Pandas en memoria a la vez,
  así que más workers escalan el pico de memoria casi linealmente — con
  `BACKEND_MEM_LIMIT=512M` ya fijado, subir el paralelismo sin subir el
  límite en la misma proporción es la ruta directa a un OOM kill.
  `--max-requests 1000` recicla el worker periódicamente para no acumular
  fugas de memoria en un proceso de vida larga. Detalle y justificación
  extendida en `docs/TESTING_STRATEGY.md` secciones 2 y 4.
- **Tailwind CSS v4 como capa de estilos del frontend**: integrado vía `@tailwindcss/vite`
  (plugin de Vite, sin `tailwind.config.js`/PostCSS separado — configuración de tema
  CSS-first en `frontend/src/main.css` con `@theme`). Reemplaza el CSS plano de
  `Dashboard.css` (eliminado). No es un cambio de los frameworks fijados arriba (sigue
  siendo React + Vite); es la elección de la capa de estilos dentro de ese stack. La
  tipografía usa `Inter`/`Geist Sans` como preferencia con fallback a fuentes nativas del
  sistema, sin CDN externo, para no violar la CSP `style-src 'self'; connect-src 'self'`
  de `frontend/nginx.conf` (vigente desde 1.2.0).
- **`React.lazy`/`Suspense` sobre el único punto de entrada (`DashboardPage`), sin router**:
  la app no tiene múltiples rutas — un router solo para justificar el code-splitting habría
  sido la definición de sobreingeniería. Se aplicó `React.lazy` igual, separando el bundle
  de `DashboardPage` (React Query, react-window, lógica de cliente) del shell de `App.tsx`.
  `vite.config.ts` complementa esto con `manualChunks` (vendor React/Query/react-window
  separados) y `rollup-plugin-visualizer` (`dist/stats.html` en cada build) para auditar el
  tamaño de los chunks. Detalle y números reales de un build en `CHANGELOG.md` (sección
  "Unreleased" del rediseño visual) y `docs/TESTING_STRATEGY.md`.
- **Sistema de Toast propio, sin librería (`Toast.tsx`)**: Context + `useState` de React,
  sin dependencia nueva — la necesidad (1-2 notificaciones de éxito/error con auto-dismiss)
  no justifica una librería como `sonner`/`react-hot-toast`.
- **Auditoría de seguridad vía log, no excepción, al truncar input**:
  `_sanitize_query` (`fuzzy_match.py`) emite `logger.warning` cuando una
  query supera los 200 caracteres, y sigue procesando la versión truncada
  en vez de devolver un error al cliente — la query truncada sigue siendo
  una búsqueda válida, así que no hay razón para penalizar al usuario con
  un 4xx. Detalle de la justificación en `docs/TESTING_STRATEGY.md`
  sección 4. El límite del lado del cliente (`maxLength={200}` en
  `Dashboard.tsx`) es UX, no el control de seguridad — ese sigue siendo
  exclusivamente server-side.

Ninguno de estos puntos introdujo una tecnología, ORM, base de datos o cola
de mensajes fuera de las fijadas en "Decisión". Detalle de qué se evaluó y
se descartó explícitamente: `CHANGELOG.md` (secciones "Rechazado /
Descartado" de cada versión) y `docs/TESTING_STRATEGY.md` (sección
"4. Decisiones Históricas y Deuda Técnica").
