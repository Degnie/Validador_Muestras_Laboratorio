import type { DashboardResponse, EstadoMuestra, MuestraEstado } from "../types/muestra";

const ESTADOS_VALIDOS: readonly EstadoMuestra[] = ["Completo", "Faltante", "Pruebas Fantasma"];

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

// Guarda de contrato milimétrica: si el backend cambia la forma de la respuesta (un campo
// renombrado, un estado nuevo no contemplado en EstadoMuestra) sin que el frontend se
// entere, esto lo convierte en un error explícito en vez de un fallo silencioso más
// adelante (ej. `.map is not a function` o un estado sin estilo en ESTADO_CLASS).
function isMuestraEstado(value: unknown): value is MuestraEstado {
  if (typeof value !== "object" || value === null) return false;
  const m = value as Record<string, unknown>;
  return (
    typeof m.id_muestra === "string" &&
    ESTADOS_VALIDOS.includes(m.estado as EstadoMuestra) &&
    Array.isArray(m.pruebas_faltantes) &&
    m.pruebas_faltantes.every((p) => typeof p === "string") &&
    Array.isArray(m.pruebas_fantasma) &&
    m.pruebas_fantasma.every((p) => typeof p === "string")
  );
}

function isDashboardResponse(data: unknown): data is DashboardResponse {
  if (typeof data !== "object" || data === null) return false;
  const d = data as Record<string, unknown>;
  return (
    Array.isArray(d.muestras) &&
    d.muestras.every(isMuestraEstado) &&
    Array.isArray(d.alertas_desfase) &&
    d.alertas_desfase.every((a) => typeof a === "string")
  );
}

async function fetchJson(url: string, signal?: AbortSignal): Promise<DashboardResponse> {
  let response: Response;
  try {
    response = await fetch(url, { signal });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
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

export async function fetchDashboard(query?: string, signal?: AbortSignal): Promise<DashboardResponse> {
  const url = query ? `/api/muestras/buscar?q=${encodeURIComponent(query)}` : "/api/muestras";
  return fetchJson(url, signal);
}

export async function exportDashboard(signal?: AbortSignal): Promise<Blob> {
  let response: Response;
  try {
    response = await fetch("/api/muestras/exportar", { signal });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throw new ApiError(0, "No se pudo conectar para exportar");
  }
  if (!response.ok) {
    throw new ApiError(response.status, `Error al exportar: ${response.status}`);
  }
  return response.blob();
}
