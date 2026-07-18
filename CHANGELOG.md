# Changelog

## [1.3.0] - 2026-07-18

Tercera pasada de la misma auditoría de producción. Alcance explícitamente acotado por el usuario: sin cambios de Docker/Nginx en esta iteración.

- **Mitigación de XXE**: se agregó `defusedxml` a `backend/requirements.txt`. openpyxl detecta esta dependencia en su propio `__init__` (`openpyxl.DEFUSEDXML`) y, si está instalada, reemplaza automáticamente `xml.etree.ElementTree.fromstring`/`iterparse` por los de `defusedxml` en todo el proceso — cero cambios de código en `ingestion.py`, es el mecanismo que la propia librería expone para esto.
- **Mitigación real de Zip Bomb**: `assert_safe_excel_file` (`backend/app/services/ingestion.py`) ahora inspecciona el directorio central del zip (`zipfile.ZipFile(...).infolist()`, sin descomprimir nada) y rechaza archivos cuyo tamaño descomprimido total supere 200 MB o cuyo ratio de compresión supere 100x. El chequeo de tamaño en disco que ya existía no alcanzaba: un `.xlsx` con un `sharedStrings.xml` que comprime a un par de KB y se infla a gigas pasaba ese chequeo sin problema (openpyxl carga ese part completo en memoria incluso en modo `read_only`, para poder resolver los IDs de string de cada celda).
- **Tests de inyección de fallos** (`backend/tests/test_ingestion.py`): zip bomb por tamaño absoluto, zip bomb por ratio de compresión, y zip corrupto con magic bytes válidos pero contenido truncado.
- **Runtime schema guard más estricto** en `frontend/src/services/api.ts`: `isDashboardResponse` ahora valida cada `MuestraEstado` campo por campo (id string, estado dentro del enum válido, arrays de strings), no solo que `muestras`/`alertas_desfase` sean arrays. Se evaluó Zod explícitamente y se descartó (ver rechazadas).
- **AbortController real, vía el mecanismo nativo de React Query**: `fetchDashboard`/`exportDashboard` ahora aceptan un `AbortSignal` y se lo pasan a `fetch`; `DashboardPage` usa el `signal` que la propia `queryFn` de TanStack Query provee y aborta automáticamente cuando `debouncedQuery` cambia o el componente se desmonta. Un `AbortError` ya no se envuelve en `ApiError` (se re-lanza tal cual, para que React Query lo trate como cancelación y no como fallo).

**Recomendaciones rechazadas/pausadas:**

- Las optimizaciones de Docker y Nginx se han suspendido y excluido de esta iteración debido a un error interno reportado por el usuario.
- **Zod** para validación de esquemas: se mantuvo el guard hecho a mano (`isDashboardResponse`/`isMuestraEstado`), ahora reforzado campo por campo. Agregar Zod habría sido una dependencia estructural nueva para resolver algo que un type guard de ~15 líneas sin dependencias ya cubre por completo — no hay justificación que le gane al ADR-001.
- **`throwOnError: true` global** en `queryClient.ts`: se pidió para que las caídas de red activen el `ErrorBoundary` de inmediato, pero `DashboardPage` ya maneja el error de la query localmente con un banner específico por código HTTP (0/413/422/500), cubierto por 5 tests existentes. Poner `throwOnError` global habría reemplazado ese mensaje específico por el fallback genérico del `ErrorBoundary` y roto esos tests — el `ErrorBoundary` se dejó como red de contención para errores de *render* que escapan a React Query (su propósito original), no como reemplazo del manejo de errores de query que ya funciona mejor.
- **Copias profundas en `validation_rules.py`**: se revisó el archivo completo; ya opera sobre `set`/`groupby` por referencia, sin ningún `.copy()`/deep copy. No había nada que optimizar.
- **Streaming de exportación**: `exportar_muestras` (`backend/app/api/muestras.py`) ya devuelve `StreamingResponse` desde la iteración anterior. No se tocó.

## [1.2.0] - 2026-07-18

Segunda pasada de la misma auditoría de producción de la iteración anterior. La mayoría de los puntos pedidos (mitigación de Zip Bomb, patrón Strategy sin clonar memoria, matching vectorizado vía `rapidfuzz`, contenedores multi-stage non-root, manejador global de excepciones sin fuga de stack traces) ya estaban resueltos en `1.1.0` y se dejaron sin tocar. Se agregó lo que faltaba de verdad:

- Rate limiting en `backend/app/core/middleware.py` (`RateLimitMiddleware`): ventana deslizante en memoria por IP, 60 req/min por defecto, responde 429 + `Retry-After`. Sin dependencias nuevas (usa solo `collections.deque`), consistente con el stack fijado en [ADR-001](docs/ADR-001-Stack-Tecnologico.md).
- `frontend/src/components/ErrorBoundary.tsx`: red de contención para errores de render de React que escapan al manejo de errores de React Query (que solo cubre queries/mutations, no excepciones en el árbol de componentes). Envuelve `DashboardPage` en `App.tsx`.
- `frontend/nginx.conf`: cabeceras de seguridad (`HSTS`, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `CSP`) en las respuestas estáticas servidas por Nginx — antes solo la API FastAPI las enviaba, no los assets del dashboard. `try_files` ahora también prueba `$uri/` antes de caer al SPA fallback.
- Nuevo `docs/TESTING_STRATEGY.md` documentando los criterios de inyección de fallos, límites de payload y la estrategia de invalidación de caché del lado del cliente.

**Recomendaciones rechazadas:** el prompt de auditoría pedía `useMuestrasMutation`, invalidación de caché "tras la subida de un archivo maestro" y Optimistic UI, y tests de subida de archivos corruptos vía HTTP con 400/413. Esta API es de solo lectura (`GET /api/muestras`, `/buscar`, `/exportar`); no existe ningún endpoint de subida ni mutación en el sistema, así que esas piezas no se implementaron — hacerlo habría significado inventar una feature que el proyecto no tiene. La validación de archivos corruptos ya se cubre donde sí existe: en la ingesta de los Excel de origen (`test_integration.py::test_malicious_extension_is_rejected_before_parsing`, `test_ingestion.py`).

## [1.1.0] - 2026-07-18

Esta iteración fue una auditoría orientada a preparación para producción: memoria, arquitectura de la capa de reglas y hardening de la API y los contenedores.

**Nuevos cambios implementados:**

- Refactorización de la capa de ingesta (`backend/app/services/ingestion.py`) a lectura streaming por lotes vía `openpyxl` en modo `read_only`, y agregué validación de *magic bytes* (no solo la extensión `.xlsx`) antes de intentar parsear cualquier archivo.
- Implementé el patrón Chain of Responsibility en `backend/app/services/validation_rules.py` (`ReglaPruebasFantasma` → `ReglaPruebasFaltantes` → `ReglaCompleto`) para poder agregar reglas de laboratorio nuevas sin tocar las existentes.
- Hardening de `backend/app/main.py`: límite de tamaño de payload (413), headers de seguridad (HSTS, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`) y un manejador de excepciones que nunca devuelve el stack trace real al cliente.
- Reescribí ambos `Dockerfile` con build multi-etapa: el backend corre con Gunicorn + workers de Uvicorn bajo un usuario `appuser` sin privilegios, y el frontend se compila con Node/Vite y se sirve con `nginx-unprivileged` (puerto 8080, sin root).
- Sincronicé el contrato de datos entre `frontend/src/types/muestra.ts` y `backend/app/models/schemas.py` agregando una guarda de forma en tiempo de ejecución (`isDashboardResponse`) en `api.ts`, para que un desalineamiento futuro sea un error explícito y no un fallo silencioso en el Dashboard.
- Manejo de errores de red resiliente: `api.ts` ahora tipa los errores como `ApiError` (con el código HTTP) y `Dashboard.tsx` los traduce a un banner con mensaje amigable en vez de dejar la pantalla en blanco o mostrar el error crudo.
- Amplié la suite de tests: casos límite de ingesta (archivos corruptos, extensión falseada, tamaño excedido), 413/422 en la API, no fuga de stack traces, y fallos de red simulados en el flujo de búsqueda/exportación del frontend.

**Hallazgo de esta iteración (no era un cambio de stock, era una corrección de documentación):** la nota que había dejado sobre que `thefuzz` corría "en modo Python puro" por no tener `python-Levenshtein` para Python 3.14 era incorrecta. Desde la versión 0.20, `thefuzz` delega internamente en `rapidfuzz` (C++, vectorizado), que sí publica wheel para 3.14 — ya estaba instalado como dependencia transitiva. Lo dejé fijado explícito en `requirements.txt` y corregí la nota en el README y en el ADR.

**Recomendaciones rechazadas:** ninguna en esta sesión; se mantuvo el stack de [ADR-001-Stack-Tecnologico.md](docs/ADR-001-Stack-Tecnologico.md).

## Iteración 1

**Nuevos cambios implementados:**

- Incorporación de barra de búsqueda rápida por código en el Dashboard (Frontend).
- Optimización de ingesta de Excel por chunks para evitar sobrecarga de memoria (Backend).
- Creación de suite de pruebas de integración obligatorias para el flujo de validación.
- Creación de configuración Docker (`docker-compose.yml`) y `.env.example` para despliegue local aislado.
- Implementación de React Query y virtualización de listas en la UI.

**Recomendaciones rechazadas:** Ninguna en esta sesión. Se mantuvieron las tecnologías dictadas en [ADR-001-Stack-Tecnologico.md](docs/ADR-001-Stack-Tecnologico.md).
