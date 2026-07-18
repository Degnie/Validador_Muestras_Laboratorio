from typing import Literal

from pydantic import BaseModel, Field

EstadoMuestra = Literal["Completo", "Faltante", "Pruebas Fantasma"]


class MuestraEstado(BaseModel):
    id_muestra: str
    estado: EstadoMuestra
    pruebas_faltantes: list[str]
    pruebas_fantasma: list[str]


class DashboardResponse(BaseModel):
    muestras: list[MuestraEstado]
    alertas_desfase: list[str]
    errores_validacion: list[str] = Field(default_factory=list)
