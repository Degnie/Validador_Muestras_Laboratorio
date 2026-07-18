# Estrategia de Testing

Este documento registra *por qué* la suite de tests está estructurada como está, no repite lo que el código ya dice. Referencia: [ADR-001-Stack-Tecnologico.md](ADR-001-Stack-Tecnologico.md).

## Inyección de fallos (Failure Injection)

El sistema cruza cuatro archivos Excel que llegan de fuentes externas (áreas del laboratorio) fuera de nuestro control. La suite asume que esos archivos van a llegar rotos, y prueba explícitamente:

- **Extensión falseada**: un `.csv` renombrado a `.xlsx` (`test_integration.py::test_malicious_extension_is_rejected_before_parsing`). La defensa es el chequeo de *magic bytes* en `ingestion.assert_safe_excel_file`, no la extensión declarada.
- **Archivo sobredimensionado**: rechazo por tamaño antes de intentar abrir el workbook (`test_ingestion.py`), para no darle a un Zip Bomb la oportunidad de descomprimirse en memoria.
- **Zip Bomb (por tamaño descomprimido y por ratio de compresión)**: `test_assert_safe_excel_file_rejects_zip_bomb_by_uncompressed_size` y `..._by_compression_ratio` construyen un `.xlsx` cuyo tamaño en disco es mínimo pero cuyo `sharedStrings.xml` se infla a >200 MB al descomprimir. El chequeo de tamaño de archivo por sí solo no detecta esto (es exactamente el vector real de un Zip Bomb: comprime muy bien, pesa poco). La defensa lee `zipfile.ZipFile(...).infolist()` — metadata del directorio central, sin descomprimir nada — antes de dejar que openpyxl abra el archivo.
- **XXE (XML External Entity)**: no se prueba con un test dedicado porque la mitigación es a nivel de dependencia, no de lógica propia: `defusedxml` instalado hace que openpyxl (que chequea `DEFUSEDXML` en su propio `__init__`) reemplace el parser XML stdlib por uno que no resuelve entidades externas ni expande bombas de entidades, en todo el proceso. Verificar la mitigación es verificar que la dependencia esté instalada (`requirements.txt`), no escribir un test de comportamiento.
- **Zip corrupto con magic bytes válidos**: un archivo que arranca con `PK\x03\x04` (pasa el chequeo de magic bytes) pero cuyo contenido está truncado (`test_assert_safe_excel_file_rejects_corrupt_zip_with_valid_magic_bytes`) — la extensión y los primeros bytes no garantizan que el zip sea válido.
- **Filas inválidas**: una fila que no valida contra el schema Pydantic (`ChecklistRow`/`AnalisisRow`) aborta la ingesta completa con 422 en vez de propagar datos corruptos al dashboard (`test_hardening.py::test_known_http_errors_still_get_their_real_status_code`).
- **Excepciones no controladas en el handler**: se fuerza un `RuntimeError` con un mensaje que nunca debería llegar al cliente, y se verifica que el 500 devuelto no contenga ni el mensaje ni el traceback (`test_hardening.py::test_unhandled_exception_does_not_leak_internals`).
- **Fallas de red en el cliente**: `DashboardPage.test.tsx` mockea `fetchDashboard`/`exportDashboard` rechazando con cada código relevante (0 = sin conexión, 413, 422, 500) y verifica que la UI muestre un banner legible en vez de pantalla en blanco o el error crudo.

Regla para tests nuevos: si un test de ingesta o de API no fuerza al menos un caso de "esto vino roto", la cobertura de esa ruta está incompleta.

## Límites de payload

- **Request entrante**: `MaxBodySizeMiddleware` rechaza con 413 antes de leer el body si `Content-Length` supera 1 MB — justificado porque la API es de solo lectura (no recibe archivos por HTTP, los lee del disco vía `Settings.data_dir`).
- **Rate limiting**: `RateLimitMiddleware` limita a 60 requests/60s por IP (429 + `Retry-After`), para contener un cliente que golpea el endpoint de forma repetida (loop de polling roto, script, o abuso). Ventana deslizante en memoria del proceso; si el backend corre con más de un worker Gunicorn, cada worker cuenta por separado (ceiling documentado en el código, no hay estado compartido tipo Redis).
- **Archivo Excel de origen**: `MAX_EXCEL_SIZE_MB = 20` en `ingestion.py`, chequeado por tamaño en disco antes de que `openpyxl` toque el contenido.

## Estrategia de invalidación de caché (React Query)

El dashboard es de solo lectura: no hay mutaciones ni endpoints de subida, así que no existe "invalidar tras escribir". La estrategia real es:

- **`queryKey: ["muestras", debouncedQuery]`**: cada búsqueda es una entrada de caché distinta; React Query no necesita invalidación manual porque el query key ya captura la única variable de estado (el texto de búsqueda).
- **Reintentos selectivos** (`queryClient.ts::shouldRetry`): un 4xx (422 datos inválidos, 413 payload grande) no se reintenta — reintentar no cambia una fila inválida en el Excel de origen. Un fallo de red (status 0) o 5xx transitorio sí vale un reintento único.
- **Refresco de datos**: como los archivos fuente cambian fuera de la app (otro proceso los sobreescribe), la frescura se comunica vía `alertas_desfase` (calculado en `check_file_freshness`), no vía invalidación de query — no hay evento del lado del cliente que dispare la actualización, así que se corrige el string de la respuesta en vez de fingir una invalidación que no tiene qué invalidar.

Si en el futuro se agrega un endpoint de subida de archivo maestro, el punto de extensión correcto es un `onSuccess` en la mutación que llame `queryClient.invalidateQueries({ queryKey: ["muestras"] })` — no existe ese código hoy porque no existe la mutación.

## `ErrorBoundary` ante fallos de red en el cliente

`ErrorBoundary` (`frontend/src/components/ErrorBoundary.tsx`) **no** es el mecanismo que maneja errores de red — ese trabajo lo hace `DashboardPage` leyendo el `error` que devuelve `useQuery` y mostrando un banner con mensaje específico por código HTTP (`ApiError.friendlyMessage`: 0/413/422/500), cubierto por los tests de `DashboardPage.test.tsx` descriptos arriba.

El `ErrorBoundary` cubre la clase de fallo distinta que React Query no atrapa: una excepción lanzada durante el *render* de un componente (un prop con forma inesperada llegando más allá del guard de `api.ts`, un bug en un formateador de datos). Sin él, ese tipo de error tira toda la app a blanco; con él, se muestra un fallback genérico y el error queda logueado vía `componentDidCatch`. Se probó deliberadamente por separado (`ErrorBoundary.test.tsx`, forzando un `throw` en el render) en vez de intentar reusar los tests de error de red de `DashboardPage`, porque son dos mecanismos distintos con responsabilidades distintas.

Por esto se descartó poner `throwOnError: true` global en `queryClient.ts`: habría redirigido los errores de query hacia el `ErrorBoundary` (mensaje genérico), pisando el banner específico por código HTTP que ya existe y que la UX prefiere.

## AbortController y cancelación de requests obsoletos

`fetchDashboard`/`exportDashboard` (`frontend/src/services/api.ts`) aceptan un `AbortSignal` opcional y se lo pasan a `fetch`. `DashboardPage` no crea su propio `AbortController`: usa el `signal` que la propia `queryFn` de TanStack Query inyecta (`({ signal }) => fetchDashboard(debouncedQuery, signal)`), que React Query aborta automáticamente cuando `debouncedQuery` cambia (la query anterior queda obsoleta) o el componente se desmonta. Un `AbortError` se re-lanza tal cual en `api.ts` (no se envuelve en `ApiError`) para que React Query lo trate como cancelación, no como fallo a mostrar en un banner.
