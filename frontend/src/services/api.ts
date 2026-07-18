import type { DashboardResponse } from "../types/muestra";

export async function fetchDashboard(): Promise<DashboardResponse> {
  const response = await fetch("/api/muestras");
  if (!response.ok) {
    throw new Error(`Error al consultar /api/muestras: ${response.status}`);
  }
  return response.json();
}
