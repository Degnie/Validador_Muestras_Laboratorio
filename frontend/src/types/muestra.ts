export type EstadoMuestra = "Completo" | "Faltante" | "Pruebas Fantasma";

export interface MuestraEstado {
  id_muestra: string;
  estado: EstadoMuestra;
  pruebas_faltantes: string[];
  pruebas_fantasma: string[];
}

export interface DashboardResponse {
  muestras: MuestraEstado[];
  alertas_desfase: string[];
  errores_validacion: string[];
}
