# Changelog

Todos los cambios notables de este proyecto serán documentados en este archivo.
El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/).

## [Unreleased]

### Added
- Límite de memoria (`deploy.resources.limits.memory: 512M`) para el servicio `backend` en `docker-compose.yml`, para que un pico de la ingesta (streaming por lotes, ver "Rechazado" más abajo) no se lleve puesta la máquina host.
- Sanitización de input en el motor de búsqueda difusa (`backend/app/services/fuzzy_match.py::_sanitize_query`): el `q` que llega de `/api/muestras/buscar` se limpia de caracteres de control y se trunca a 200 caracteres antes de tocar `thefuzz`/`rapidfuzz`. `thefuzz` nunca interpreta el input como patrón (no hay superficie de inyección tipo regex/SQL), así que esto es defensa en profundidad contra input adversarial/ruido, no una vulnerabilidad que existiera antes.
- Tests de la sanitización nueva en `test_fuzzy_search.py`: caracteres de control, query de 10.000 caracteres, query compuesta solo por caracteres de control.

### Changed
- Ninguno en esta iteración (la lógica de negocio, `validation_rules.py` y los modelos existentes no se tocaron, según lo pedido).

### Rechazado / Descartado
- **Manejador global de excepciones sanitizado (`backend/app/main.py`/`middleware.py`), streaming/chunking en `ingestion.py`, Multi-stage builds en ambos `Dockerfile`, cabeceras de seguridad + `try_files` de SPA en `nginx.conf`, sincronización `muestra.ts` ↔ `schemas.py`**: ya estaban implementados desde 1.1.0–1.5.0 (ver esas secciones). Se releyó el código de cada uno contra esta ronda de auditoría y no requirieron cambios; ver `docs/ADR-001-Stack-Tecnologico.md` para la referencia consolidada.
- **`queryClient.invalidateQueries()` tras mutaciones de lotes de muestras**: no aplica. La API es de solo lectura (`GET /api/muestras`, `/buscar`, `/exportar`); no existe ningún endpoint `POST`/`PUT`/`DELETE` en `api/muestras.py` que mute un lote de muestras. Introducir invalidación de caché para una mutación que no existe habría sido código muerto. Si en el futuro se agrega un endpoint de subida/edición, el punto de extensión ya está documentado en `docs/TESTING_STRATEGY.md` sección 2.
- **`backend/Dockerfile` a distroless o Alpine**: se mantiene `python:3.12-slim`. `pandas`/`numpy` no publican wheels para musl (Alpine); migrar forzaría compilar ambos desde código fuente dentro de la imagen (build lento y fragile, mismo tipo de problema de wheels ya documentado en el ADR-001 para Python 3.14). `slim` ya es la imagen mínima que no paga ese costo, y el build sigue siendo multi-stage con usuario `appuser` sin privilegios.
- **Colas de mensajes externas (RabbitMQ/Celery/Redis) para la ingesta**: descartado, fuera del stack fijado en el ADR-001; el chunking en memoria (`read_excel_normalized`, ya vigente desde 1.1.0) cubre el caso de uso sin agregar infraestructura nueva.
- **Reescritura de `fuzzy_match.py`/`validation_rules.py` más allá de la sanitización de input**: la cobertura de tests existente valida que los algoritmos cumplen la necesidad de negocio; no se tocó la lógica de matching/estado.

## [1.5.0] - 2026-07-18

### Añadido (Added)
* `errores_validacion: list[str]` en `DashboardResponse` (`backend/app/models/schemas.py`): lista los mensajes de fila descartada por `/api/muestras` y `/api/muestras/buscar`. Reflejado en el frontend (`muestra.ts`, `api.ts::isDashboardResponse`) y mostrado en un banner nuevo (`Dashboard.tsx`, clase `.alerta-validacion`) que no oculta la tabla de resultados.
* `fuzzy_correct_threshold` / `fuzzy_search_threshold` en `backend/app/core/config.py` (con overrides `FUZZY_CORRECT_THRESHOLD` / `FUZZY_SEARCH_THRESHOLD`), inyectados en `correct_ids`/`search_by_code` desde `api/muestras.py` en vez de usar los defaults hardcodeados de `fuzzy_match.py`.
* Tests de hardening (`test_hardening.py`): query param malformado (inyección/HTML) y query param excesivamente largo (50k caracteres) contra `/api/muestras/buscar`, verificando que el middleware/endpoint no crashee.
* Tests de partial success (`test_ingestion.py`, `test_api.py`): fila inválida descartada sin abortar el resto del lote, lote 100% inválido devuelve resultado vacío sin excepción.

### Cambiado (Changed)
* **`validate_rows` (`backend/app/services/ingestion.py`) ahora es partial-success**: antes abortaba la ingesta completa (`raise ValueError`) ante la primera fila que no pasara el schema Pydantic; ahora descarta solo esa fila, sigue procesando el resto, y devuelve `(DataFrame, list[str])` con un mensaje por fila descartada. Un error de *archivo* completo (extensión, magic bytes, Zip Bomb, zip corrupto) sigue abortando con 422, porque ahí no hay "resto del lote" que rescatar.
* `test_known_http_errors_still_get_their_real_status_code` (`test_hardening.py`) ya no fuerza el 422 con una fila inválida (ese caso ahora es 200 partial-success); usa un archivo con magic bytes inválidos, que sigue siendo un error de archivo completo.

### Arreglado (Fixed)
* Ninguno en esta iteración.

### Rechazado / Descartado (Rejected/Discarded)
* **Manejador global de excepciones sanitizado, non-root + servidor ASGI de producción en `backend/Dockerfile`, multi-stage + non-root en `frontend/Dockerfile`, CSP/`X-Content-Type-Options`/`X-Frame-Options` en `nginx.conf`, `AbortController` en `api.ts` vía el `signal` de React Query, interceptor centralizado de errores HTTP (`ApiError`/`fetchJson`)**: ya estaban implementados desde 1.1.0–1.3.0 (ver esas secciones). Se verificaron contra la auditoría de esta iteración y no requirieron cambios.
* **Refactor de `download.ts` a "procesamiento async explícito de streams"**: descartado. `exportDashboard` ya devuelve el Blob vía `response.blob()` (asíncrono, no bloqueante); `triggerDownload` solo crea el `<a>` y dispara el click, sin trabajo de parsing que valga la pena mover a un Worker para el tamaño de archivo que maneja esta app (un Excel de unas pocas decenas de miles de filas). Envolver esto en más máquina asíncrona habría sido código sin beneficio medible.
* **Endpoint/gestión de errores por lote vía cola de mensajes o tabla de auditoría de errores**: descartado. El sistema no tiene base de datos ni cola de mensajes (ADR-001); `errores_validacion` se devuelve inline en la misma respuesta del dashboard, consistente con el resto de la arquitectura de solo lectura sobre 4 Excel.
* **Mover el umbral de `MAX_EXCEL_SIZE_MB` / `MAX_UNCOMPRESSED_MB` / `MAX_COMPRESSION_RATIO` a `config.py`**: descartado en esta iteración. La auditoría pedía explícitamente los umbrales de *fuzzy matching*; los límites de seguridad de ingesta (Zip Bomb, tamaño) son constantes de seguridad, no parámetros de negocio para ajustar en tests, y moverlos no estaba en el alcance pedido.

## [1.4.0] - 2026-07-18

### Añadido (Added)
* Test de regresión (`DashboardPage.test.tsx`, "keeps focus on the search input and debounces the fetch while typing") que escribe carácter por carácter con timers falsos y verifica que (a) `document.activeElement` sigue siendo el input después de cada tecla y (b) `fetchDashboard` se llama una sola vez recién al vencer el debounce, no en cada tecla.
* `HEALTHCHECK` en `backend/Dockerfile` (golpea `GET /api/muestras` con `urllib` de la stdlib, sin instalar `curl` en la imagen).

### Cambiado (Changed)
* Ninguno en esta iteración.

### Arreglado (Fixed)
* **Foco del input de búsqueda:** se investigó el reporte de que el input pierde el foco al escribir cada carácter y dispara una petición por tecla. El componente ya era correcto desde la 1.1.0 (`Dashboard.tsx` usa un `<input>` en un componente de función estable, sin recrearse entre renders; `DashboardPage.tsx` ya aplicaba `useDebounce(query, 300)` y el fetch solo se dispara cuando cambia `debouncedQuery`). No hizo falta ningún cambio de código — se dejó el test de regresión de la sección "Añadido" como evidencia verificable de que el comportamiento es correcto.

### Rechazado / Descartado (Rejected/Discarded)
* Patrón Strategy en `validation_rules.py`, streaming por lotes en `ingestion.py`, filtrado exacto previo a la búsqueda difusa en `fuzzy_match.py`, usuario no-root y multi-stage en ambos `Dockerfile`: ya estaban implementados desde 1.1.0–1.3.0, sin cambios.
* **Simular caídas de base de datos:** el proyecto no tiene base de datos (lee 4 Excel de `DATA_DIR`, sin ORM ni motor de datos en `config.py`). No se agregó una capa de base de datos solo para poder simular su caída.
* **Parseo de fechas ISO en `api.ts`/`muestra.ts`:** el contrato de datos (`schemas.py` / `muestra.ts`) no tiene ningún campo de fecha — es todo `str`/`list[str]`/el enum de estado. Agregar parseo de fechas habría sido código sin ningún campo que lo use.
* **Interceptores tipo Axios:** el stack fijado en el ADR-001 no usa Axios; `api.ts` ya centraliza la traducción de errores en un wrapper (`fetchJson`/`ApiError`) desde la 1.1.0, equivalente correcto para `fetch`.

## [1.3.0] - 2026-07-18

### Añadido (Added)
* `defusedxml` en `backend/requirements.txt` como mitigación de XXE: openpyxl detecta esta dependencia en su propio `__init__` (`openpyxl.DEFUSEDXML`) y, si está instalada, reemplaza automáticamente el parser XML stdlib por el de `defusedxml` en todo el proceso.
* Mitigación de Zip Bomb en `assert_safe_excel_file` (`backend/app/services/ingestion.py`): inspección del directorio central del zip (`zipfile.ZipFile(...).infolist()`, sin descomprimir nada) con rechazo si el tamaño descomprimido total supera 200 MB o el ratio de compresión supera 100x.
* Tests de inyección de fallos en `backend/tests/test_ingestion.py`: zip bomb por tamaño absoluto, zip bomb por ratio de compresión, y zip corrupto con magic bytes válidos pero contenido truncado.

### Cambiado (Changed)
* `isDashboardResponse` (`frontend/src/services/api.ts`) ahora valida cada `MuestraEstado` campo por campo (id string, estado dentro del enum válido, arrays de strings), no solo que `muestras`/`alertas_desfase` sean arrays.
* `fetchDashboard`/`exportDashboard` aceptan un `AbortSignal` y se lo pasan a `fetch`; `DashboardPage` usa el `signal` que la propia `queryFn` de TanStack Query provee, que aborta automáticamente cuando `debouncedQuery` cambia o el componente se desmonta. Un `AbortError` ya no se envuelve en `ApiError` (se re-lanza tal cual).

### Arreglado (Fixed)
* Ninguno en esta iteración.

### Rechazado / Descartado (Rejected/Discarded)
* Las optimizaciones de Docker y Nginx se suspendieron y se excluyeron de esta iteración por alcance explícitamente acotado.
* **Zod** para validación de esquemas: se mantuvo el guard hecho a mano (`isDashboardResponse`/`isMuestraEstado`), reforzado campo por campo. Agregar Zod habría sido una dependencia estructural nueva para resolver algo que un type guard sin dependencias ya cubre por completo.
* **`throwOnError: true` global** en `queryClient.ts`: `DashboardPage` ya maneja el error de la query localmente con un banner específico por código HTTP (0/413/422/500), cubierto por tests existentes. Ponerlo global habría reemplazado ese mensaje específico por el fallback genérico del `ErrorBoundary`.
* **Copias profundas en `validation_rules.py`:** ya opera sobre `set`/`groupby` por referencia, sin ningún `.copy()`/deep copy. No había nada que optimizar.
* **Streaming de exportación:** `exportar_muestras` ya devuelve `StreamingResponse` desde la iteración anterior. No se tocó.

## [1.2.0] - 2026-07-18

### Añadido (Added)
* `RateLimitMiddleware` (`backend/app/core/middleware.py`): ventana deslizante en memoria por IP, 60 req/min por defecto, responde 429 + `Retry-After`. Sin dependencias nuevas (usa solo `collections.deque`).
* `frontend/src/components/ErrorBoundary.tsx`: red de contención para errores de render de React que escapan al manejo de errores de React Query. Envuelve `DashboardPage` en `App.tsx`.
* Cabeceras de seguridad (`HSTS`, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `CSP`) en `frontend/nginx.conf`, antes solo presentes en las respuestas de la API.
* `docs/TESTING_STRATEGY.md` (creación inicial).

### Cambiado (Changed)
* `try_files` en `nginx.conf` ahora también prueba `$uri/` antes de caer al fallback de SPA.

### Arreglado (Fixed)
* Ninguno en esta iteración.

### Rechazado / Descartado (Rejected/Discarded)
* `useMuestrasMutation`, invalidación de caché "tras la subida de un archivo maestro" y Optimistic UI, y tests de subida de archivos corruptos vía HTTP con 400/413: esta API es de solo lectura (`GET /api/muestras`, `/buscar`, `/exportar`); no existe ningún endpoint de subida ni mutación en el sistema. La validación de archivos corruptos ya se cubre donde sí existe: en la ingesta de los Excel de origen.

## [1.1.0] - 2026-07-18

### Añadido (Added)
* Validación de *magic bytes* (no solo la extensión `.xlsx`) antes de intentar parsear cualquier archivo.
* Patrón Chain of Responsibility en `backend/app/services/validation_rules.py` (`ReglaPruebasFantasma` → `ReglaPruebasFaltantes` → `ReglaCompleto`).
* Hardening de `backend/app/main.py`: límite de tamaño de payload (413), headers de seguridad (HSTS, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`) y manejador de excepciones que nunca devuelve el stack trace real al cliente.
* Guarda de forma en tiempo de ejecución (`isDashboardResponse`) en `api.ts`, sincronizando el contrato de datos entre `frontend/src/types/muestra.ts` y `backend/app/models/schemas.py`.
* Tipado de errores como `ApiError` (con código HTTP) en `api.ts`, traducido a banner con mensaje amigable en `Dashboard.tsx`.
* Casos de prueba de límite en ingesta (archivos corruptos, extensión falseada, tamaño excedido), 413/422 en la API, no fuga de stack traces, y fallos de red simulados en el flujo de búsqueda/exportación del frontend.

### Cambiado (Changed)
* Refactorización de la capa de ingesta (`backend/app/services/ingestion.py`) a lectura streaming por lotes vía `openpyxl` en modo `read_only`.
* Ambos `Dockerfile` reescritos con build multi-etapa: el backend corre con Gunicorn + workers de Uvicorn bajo un usuario `appuser` sin privilegios; el frontend se compila con Node/Vite y se sirve con `nginx-unprivileged` (puerto 8080, sin root).
* Corrección de una nota de documentación: `thefuzz` no corre "en modo Python puro" por no tener `python-Levenshtein` para Python 3.14 — desde la versión 0.20, `thefuzz` delega internamente en `rapidfuzz` (C++, vectorizado), que sí publica wheel para 3.14 y ya estaba instalado como dependencia transitiva. Se fijó explícito en `requirements.txt` y se corrigió la nota en el README y en el ADR.

### Arreglado (Fixed)
* Ninguno en esta iteración.

### Rechazado / Descartado (Rejected/Discarded)
* Ninguno en esta iteración; se mantuvo el stack de [ADR-001-Stack-Tecnologico.md](docs/ADR-001-Stack-Tecnologico.md).

## [1.0.0] - 2026-07-17

### Añadido (Added)
* Barra de búsqueda rápida por código en el Dashboard (Frontend).
* Suite de pruebas de integración obligatorias para el flujo de validación.
* Configuración Docker (`docker-compose.yml`) y `.env.example` para despliegue local aislado.
* React Query y virtualización de listas en la UI.

### Cambiado (Changed)
* Optimización de ingesta de Excel por chunks para evitar sobrecarga de memoria (Backend).

### Arreglado (Fixed)
* Ninguno en esta iteración (versión inicial).

### Rechazado / Descartado (Rejected/Discarded)
* Ninguno en esta iteración; se mantuvieron las tecnologías dictadas en [ADR-001-Stack-Tecnologico.md](docs/ADR-001-Stack-Tecnologico.md).
