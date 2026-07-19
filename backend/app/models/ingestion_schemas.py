from pydantic import BaseModel


class ChecklistRow(BaseModel):
    id_muestra: str
    tipo_analisis: str
    prueba_requerida: str


class PruebaRow(BaseModel):
    """Una fila de una pestaña del Excel de Datos -- 'prueba' la asigna el ingestor a partir
    del nombre de la pestaña, no viene como columna en el archivo."""

    id_muestra: str
    prueba: str
    resultado: str
    valor: str
    tecnico: str
    fecha: str
