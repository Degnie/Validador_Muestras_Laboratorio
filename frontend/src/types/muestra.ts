export type EstadoMuestra = "Completo" | "Faltante" | "Pruebas Fantasma";

export interface PruebaDetalle {
  nombre_prueba: string;
  resultado: string;
  valor: string;
  tecnico: string;
  fecha: string;
}

export interface MuestraEstado {
  id_muestra: string;
  estado: EstadoMuestra;
  tipo_analisis: string;
  pruebas_faltantes: string[];
  pruebas_fantasma: string[];
  pruebas: PruebaDetalle[];
}

export interface DashboardResponse {
  muestras: MuestraEstado[];
  alertas_desfase: string[];
  errores_validacion: string[];
}
