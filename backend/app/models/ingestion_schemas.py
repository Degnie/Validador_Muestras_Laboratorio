from pydantic import BaseModel


class ChecklistRow(BaseModel):
    id_muestra: str
    prueba_requerida: str


class AnalisisRow(BaseModel):
    id_muestra: str
    prueba: str
