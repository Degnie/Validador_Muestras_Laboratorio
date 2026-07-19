"""Registro central de códigos de error. El campo `mensaje_usuario` es lo único que debe
llegar a un técnico de laboratorio (sin jerga de programador: nada de "input", "string",
tracebacks); `detalle_tecnico` es la referencia para quien mantiene el código -- la versión
completa, explicada, vive en docs/CODIGOS_ERROR.md."""

from dataclasses import dataclass


@dataclass(frozen=True)
class CodigoError:
    codigo: str
    mensaje_usuario: str
    detalle_tecnico: str


class ErrorAplicacion(ValueError):
    """Excepción con código: cualquier `except ValueError` existente la sigue atrapando
    (subclase), pero el mensaje que lleva ya es el texto amigable + `(código XXX-000)`, listo
    para mostrarse tal cual en el dashboard."""

    def __init__(self, codigo: CodigoError, **valores):
        self.codigo = codigo
        self.mensaje_usuario = codigo.mensaje_usuario.format(**valores)
        super().__init__(f"{self.mensaje_usuario} (código {codigo.codigo})")


# Errores de archivo completo: no se pudo ni empezar a leer el Excel, se aborta todo el lote.
ARCH_EXTENSION = CodigoError(
    "ARCH-001",
    "El archivo no es un Excel válido (debe terminar en .xlsx).",
    "assert_safe_excel_file: la extensión del archivo no es .xlsx",
)
ARCH_TAMANO = CodigoError(
    "ARCH-002",
    "El archivo es demasiado grande para procesarlo.",
    "assert_safe_excel_file: supera MAX_EXCEL_SIZE_MB (backend/app/services/ingestion.py)",
)
ARCH_CONTENIDO = CodigoError(
    "ARCH-003",
    "El archivo está dañado o no es un Excel real (puede estar renombrado desde otro formato).",
    "assert_safe_excel_file: los primeros bytes del archivo no coinciden con la firma de un .xlsx (zip) real",
)
ARCH_SOSPECHOSO = CodigoError(
    "ARCH-004",
    "El archivo parece estar dañado o manipulado.",
    "assert_safe_excel_file: tamaño descomprimido o ratio de compresión fuera de rango (posible Zip Bomb)",
)
ARCH_CORRUPTO = CodigoError(
    "ARCH-005",
    "El archivo Excel está dañado y no se pudo abrir.",
    "zipfile.BadZipFile u otra excepción de openpyxl/pandas al parsear un archivo con magic bytes válidos",
)

# Errores de fila: se descarta solo esa fila y se sigue procesando el resto del lote.
VAL_FALTA_DATO = CodigoError(
    "VAL-001",
    'Falta el dato de "{campo}" en esta fila.',
    "pydantic ValidationError, error type == 'missing' (la celda está vacía o la columna no existe en el Excel)",
)
VAL_DATO_INVALIDO = CodigoError(
    "VAL-002",
    'El dato de "{campo}" no tiene un formato válido.',
    "pydantic ValidationError, error type distinto de 'missing' (ej. 'string_type': la celda tiene un valor que no es texto)",
)

# Nombre de columna (nombre interno del DataFrame) -> como se lo nombra en el mensaje al
# usuario. Ver también backend/app/core/column_aliases.py (esos son alias de *lectura* del
# Excel de origen; este mapeo es solo para mostrar el nombre en un mensaje de error).
CAMPO_LEGIBLE = {
    "id_muestra": "ID de muestra",
    "tipo_analisis": "tipo de análisis",
    "prueba_requerida": "prueba requerida",
    "prueba": "prueba",
    "resultado": "resultado",
    "valor": "valor",
    "tecnico": "técnico",
    "fecha": "fecha",
}
