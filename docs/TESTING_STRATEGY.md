# Estrategia de Testing

Este documento registra *por qué* la suite de tests está estructurada como está, no repite lo que el código ya dice. Referencia: [ADR-001-Stack-Tecnologico.md](ADR-001-Stack-Tecnologico.md).

## Inyección de fallos (Failure Injection)

El sistema cruza cuatro archivos Excel que llegan de fuentes externas (áreas del laboratorio) fuera de nuestro control. La suite asume que esos archivos van a llegar rotos, y prueba explícitamente:

- **Extensión falseada**: un `.csv` renombrado a `.xlsx` (`test_integration.py::test_malicious_extension_is_rejected_before_parsing`). La defensa es el chequeo de *magic bytes* en `ingestion.assert_safe_excel_file`, no la extensión declarada.
- **Archivo sobredimensionado**: rechazo por tamaño antes de intentar abrir el workbook (`test_ingestion.py`), para no darle a un Zip Bomb la oportunidad de descomprimirse en memoria.
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
