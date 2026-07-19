# Códigos de error

Referencia para quien mantiene el código. El dashboard nunca muestra esta tabla —
un técnico de laboratorio ve solo el mensaje en español + el código entre paréntesis
(ej. `El archivo es demasiado grande para procesarlo. (código ARCH-002)`); si necesita
reportar un problema, ese código es lo que hay que buscar acá.

La fuente de verdad de estos códigos es `backend/app/core/error_codes.py`
(`CodigoError`, `ErrorAplicacion`) — este documento es una copia legible, no la
implementación. Si agregás un código nuevo, agregalo primero ahí y después reflejalo acá.

## Errores de archivo completo (`ARCH-*`)

El archivo entero no se pudo leer; la respuesta es `422` y no hay `errores_validacion`
(no hay "resto del lote" que rescatar). Se generan en
`backend/app/services/ingestion.py::assert_safe_excel_file` y se propagan sin cambios
desde `backend/app/api/muestras.py::_build_estados`.

| Código | Mensaje al técnico | Causa técnica real |
|---|---|---|
| `ARCH-001` | El archivo no es un Excel válido (debe terminar en .xlsx). | La extensión del archivo no es `.xlsx`. |
| `ARCH-002` | El archivo es demasiado grande para procesarlo. | Supera `MAX_EXCEL_SIZE_MB` (20 MB por defecto, `ingestion.py`). |
| `ARCH-003` | El archivo está dañado o no es un Excel real (puede estar renombrado desde otro formato). | Los primeros bytes no coinciden con la firma de un `.xlsx` real (`PK\x03\x04`, todo `.xlsx` es un zip) — o el zip está corrupto (`zipfile.BadZipFile`). |
| `ARCH-004` | El archivo parece estar dañado o manipulado. | El tamaño descomprimido total o el ratio de compresión del zip superan el umbral esperado (`MAX_UNCOMPRESSED_MB` / `MAX_COMPRESSION_RATIO`) — mitigación de Zip Bomb. |
| `ARCH-005` | El archivo Excel está dañado y no se pudo abrir. | Excepción no anticipada de `openpyxl`/`pandas` al parsear un archivo que sí pasó los chequeos anteriores (magic bytes válidos, tamaño ok) pero tiene contenido interno corrupto. Se loguea con `logger.warning` en `api/muestras.py`, con el texto real de la excepción — revisar el log del servidor para el detalle. |

## Errores de fila (`VAL-*`)

Una fila puntual del Excel no pasó el schema de Pydantic; se descarta esa fila, se
sigue procesando el resto del lote (partial success, `200 OK`), y el mensaje queda en
`DashboardResponse.errores_validacion`. Se generan en
`backend/app/services/ingestion.py::validate_rows`.

| Código | Mensaje al técnico | Causa técnica real |
|---|---|---|
| `VAL-001` | Falta el dato de "{campo}" en esta fila. | `pydantic.ValidationError`, `error["type"] == "missing"` — la celda está vacía o la columna no existe en esa fila del Excel. |
| `VAL-002` | El dato de "{campo}" no tiene un formato válido. | `pydantic.ValidationError` con cualquier otro `type` (ej. `"string_type"`: la celda tiene un valor que Pydantic no puede interpretar como texto). |

`{campo}` se resuelve con `CAMPO_LEGIBLE` (`error_codes.py`) a partir del nombre interno
de la columna (`id_muestra` → "ID de muestra", `tecnico` → "técnico", etc.), no con el
nombre crudo del `DataFrame`.

El mensaje completo en `errores_validacion` tiene la forma:

```
Fila {i}: {mensaje_usuario} (código {codigo})
```

y, para los datos (`Datos.xlsx`, multipestaña), se le antepone el nombre de la pestaña:

```
{nombre_hoja} - Fila {i}: {mensaje_usuario} (código {codigo})
```

## Agregar un código nuevo

1. Agregalo a `backend/app/core/error_codes.py` como una constante `CodigoError(codigo, mensaje_usuario, detalle_tecnico)`.
2. Usalo con `raise ErrorAplicacion(MI_CODIGO)` (para un error de archivo completo) o
   construí el string manualmente con el mismo formato `f"{mensaje} (código {codigo})"`
   (para un error de fila, como en `validate_rows`).
3. Sumá la fila correspondiente a la tabla de este documento.
4. `ErrorAplicacion` hereda de `ValueError`, así que cualquier `except ValueError` ya
   existente lo sigue atrapando sin cambios.
