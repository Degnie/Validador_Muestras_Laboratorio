from typing import Literal

from pydantic import BaseModel, Field

EstadoMuestra = Literal["Completo", "Faltante", "Pruebas Fantasma"]


class PruebaDetalle(BaseModel):
    nombre_prueba: str
    resultado: str
    valor: str
    tecnico: str
    fecha: str


class MuestraEstado(BaseModel):
    id_muestra: str
    estado: EstadoMuestra
    tipo_analisis: str
    pruebas_faltantes: list[str]
    pruebas_fantasma: list[str]
    pruebas: list[PruebaDetalle]


class DashboardResponse(BaseModel):
    muestras: list[MuestraEstado]
    alertas_desfase: list[str]
    errores_validacion: list[str] = Field(default_factory=list)


class NotificacionEvento(BaseModel):
    """Un item de la Watchlist del frontend (localStorage) que pasó de faltante a
    completado; el frontend detecta la transición y reporta el evento acá para
    dejar rastro server-side (historial_notificaciones.csv)."""

    id_muestra: str
    prueba: str
