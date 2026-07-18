from typing import Literal

from pydantic import BaseModel

EstadoMuestra = Literal["Completo", "Faltante", "Pruebas Fantasma"]


class MuestraEstado(BaseModel):
    id_muestra: str
    estado: EstadoMuestra
    pruebas_faltantes: list[str]
    pruebas_fantasma: list[str]


class DashboardResponse(BaseModel):
    muestras: list[MuestraEstado]
    alertas_desfase: list[str]
