import type { DashboardResponse } from "../types/muestra";

const FRIENDLY_MESSAGES: Record<number, string> = {
  0: "No se pudo conectar con el servidor. Revisá tu conexión e intentá de nuevo.",
  413: "El archivo o la solicitud es demasiado grande.",
  422: "Los datos recibidos son inválidos (revisá los Excel de origen).",
  500: "Error interno del servidor. Intentá de nuevo en un momento.",
};

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, detail: string) {
    super(detail);
    this.name = "ApiError";
    this.status = status;
  }

  get friendlyMessage(): string {
    return FRIENDLY_MESSAGES[this.status] ?? `Ocurrió un error inesperado (código ${this.status}).`;
  }
}

// Guarda mínima de contrato: si el backend cambia la forma de la respuesta sin que el
// frontend se entere, esto lo convierte en un error explícito en vez de un fallo silencioso
// más adelante (ej. `.map is not a function`).
function isDashboardResponse(data: unknown): data is DashboardResponse {
  if (typeof data !== "object" || data === null) return false;
  const d = data as Record<string, unknown>;
  return Array.isArray(d.muestras) && Array.isArray(d.alertas_desfase);
}

async function fetchJson(url: string): Promise<DashboardResponse> {
  let response: Response;
  try {
    response = await fetch(url);
  } catch {
    throw new ApiError(0, `No se pudo conectar al consultar ${url}`);
  }

  if (!response.ok) {
    throw new ApiError(response.status, `Error al consultar ${url}: ${response.status}`);
  }

  const data = await response.json();
  if (!isDashboardResponse(data)) {
    throw new ApiError(500, `Respuesta con forma inesperada desde ${url}`);
  }
  return data;
}

export async function fetchDashboard(query?: string): Promise<DashboardResponse> {
  const url = query ? `/api/muestras/buscar?q=${encodeURIComponent(query)}` : "/api/muestras";
  return fetchJson(url);
}

export async function exportDashboard(): Promise<Blob> {
  let response: Response;
  try {
    response = await fetch("/api/muestras/exportar");
  } catch {
    throw new ApiError(0, "No se pudo conectar para exportar");
  }
  if (!response.ok) {
    throw new ApiError(response.status, `Error al exportar: ${response.status}`);
  }
  return response.blob();
}
