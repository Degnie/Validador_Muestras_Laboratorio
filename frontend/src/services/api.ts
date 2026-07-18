import type { DashboardResponse } from "../types/muestra";

export async function fetchDashboard(query?: string): Promise<DashboardResponse> {
  const url = query ? `/api/muestras/buscar?q=${encodeURIComponent(query)}` : "/api/muestras";
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Error al consultar ${url}: ${response.status}`);
  }
  return response.json();
}

export async function exportDashboard(): Promise<Blob> {
  const response = await fetch("/api/muestras/exportar");
  if (!response.ok) {
    throw new Error(`Error al exportar: ${response.status}`);
  }
  return response.blob();
}
