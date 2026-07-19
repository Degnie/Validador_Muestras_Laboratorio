import type { DashboardResponse, EstadoMuestra, MuestraEstado, PruebaDetalle } from "../types/muestra";

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
function isPruebaDetalle(value: unknown): value is PruebaDetalle {
  if (typeof value !== "object" || value === null) return false;
  const p = value as Record<string, unknown>;
  return (
    typeof p.nombre_prueba === "string" &&
    typeof p.resultado === "string" &&
    typeof p.valor === "string" &&
    typeof p.tecnico === "string" &&
    typeof p.fecha === "string"
  );
}

function isMuestraEstado(value: unknown): value is MuestraEstado {
  if (typeof value !== "object" || value === null) return false;
  const m = value as Record<string, unknown>;
  return (
    typeof m.id_muestra === "string" &&
    ESTADOS_VALIDOS.includes(m.estado as EstadoMuestra) &&
    typeof m.tipo_analisis === "string" &&
    Array.isArray(m.pruebas_faltantes) &&
    m.pruebas_faltantes.every((p) => typeof p === "string") &&
    Array.isArray(m.pruebas_fantasma) &&
    m.pruebas_fantasma.every((p) => typeof p === "string") &&
    Array.isArray(m.pruebas) &&
    m.pruebas.every(isPruebaDetalle)
  );
}

function isDashboardResponse(data: unknown): data is DashboardResponse {
  if (typeof data !== "object" || data === null) return false;
  const d = data as Record<string, unknown>;
  return (
    Array.isArray(d.muestras) &&
    d.muestras.every(isMuestraEstado) &&
    Array.isArray(d.alertas_desfase) &&
    d.alertas_desfase.every((a) => typeof a === "string") &&
    Array.isArray(d.errores_validacion) &&
    d.errores_validacion.every((e) => typeof e === "string")
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

// Best-effort: si el registro de auditoría falla, no debe romper la notificación local (el
// usuario ya la vio en el buzón); solo se ignora el error acá.
export async function postNotificacion(id_muestra: string, prueba: string): Promise<void> {
  try {
    await fetch("/api/notificaciones", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id_muestra, prueba }),
    });
  } catch {
    // sin conexión: el evento simplemente no queda en el CSV de auditoría del backend.
  }
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
