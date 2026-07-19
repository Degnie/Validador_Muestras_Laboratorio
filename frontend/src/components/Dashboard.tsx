import { List, type RowComponentProps } from "react-window";

import type { ApiError } from "../services/api";
import type { DashboardResponse, EstadoMuestra, MuestraEstado } from "../types/muestra";

const ESTADO_CLASS: Record<EstadoMuestra, string> = {
  Completo: "bg-success-bg text-success",
  Faltante: "bg-orange-100 text-orange-800",
  "Pruebas Fantasma": "bg-purple-100 text-purple-800",
};

const ROW_HEIGHT = 44;
const SKELETON_ROW_COUNT = 8;

// Debe coincidir con MAX_QUERY_LENGTH en backend/app/services/fuzzy_match.py -- el backend ya
// trunca por seguridad, esto es solo para no dejar que el usuario escriba de más sin avisarle.
const MAX_QUERY_LENGTH = 200;

const FILA_GRID = "grid grid-cols-[140px_180px_1fr] items-center gap-2 px-3 py-2";
const FOCUS_RING =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

// Íconos inline (a mano, trazos de Heroicons v2 -- MIT) en vez de sumar una dependencia
// nueva solo por 3 glifos de 16x16.
function IconoCompleto() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function IconoFaltante() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.19-1.458-1.515-2.625L8.485 2.495zM10 6a.75.75 0 01.75.75v3a.75.75 0 01-1.5 0v-3A.75.75 0 0110 6zm0 8a.9.9 0 100-1.8.9.9 0 000 1.8z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function IconoFantasma() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0" aria-hidden="true">
      <path d="M10 6a2 2 0 100 4 2 2 0 000-4z" />
      <path
        fillRule="evenodd"
        d="M.664 10.59a1.651 1.651 0 010-1.186A10.004 10.004 0 0110 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0110 17c-4.257 0-7.893-2.66-9.336-6.41zM14 10a4 4 0 11-8 0 4 4 0 018 0z"
        clipRule="evenodd"
      />
    </svg>
  );
}

const ESTADO_ICON = {
  Completo: IconoCompleto,
  Faltante: IconoFaltante,
  "Pruebas Fantasma": IconoFantasma,
} satisfies Record<EstadoMuestra, () => ReturnType<typeof IconoCompleto>>;

function IconoCargando() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className="h-4 w-4 animate-spin text-primary"
      aria-hidden="true"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

function detalle(muestra: MuestraEstado): string {
  const partes = [];
  if (muestra.pruebas_faltantes.length > 0) partes.push(`Faltan: ${muestra.pruebas_faltantes.join(", ")}`);
  if (muestra.pruebas_fantasma.length > 0) partes.push(`Fantasma: ${muestra.pruebas_fantasma.join(", ")}`);
  return partes.join(" ");
}

function Fila({ index, style, muestras }: RowComponentProps<{ muestras: MuestraEstado[] }>) {
  const muestra = muestras[index];
  const Icono = ESTADO_ICON[muestra.estado];
  return (
    <div className={`${FILA_GRID} border-b border-gray-100 text-sm hover:bg-gray-50`} style={style}>
      <span className="font-medium text-gray-900">{muestra.id_muestra}</span>
      <span>
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${ESTADO_CLASS[muestra.estado]}`}
        >
          <Icono />
          {muestra.estado}
        </span>
      </span>
      <span className="truncate text-gray-600">{detalle(muestra)}</span>
    </div>
  );
}

function TablaSkeleton() {
  return (
    <div aria-hidden="true" className="animate-pulse divide-y divide-gray-100">
      {Array.from({ length: SKELETON_ROW_COUNT }, (_, i) => (
        <div key={i} className={FILA_GRID}>
          <span className="h-4 w-20 rounded bg-gray-200" />
          <span className="h-5 w-24 rounded-full bg-gray-200" />
          <span className="h-4 w-40 rounded bg-gray-200" />
        </div>
      ))}
    </div>
  );
}

interface DashboardProps {
  data: DashboardResponse;
  query: string;
  onQueryChange: (query: string) => void;
  onExport: () => void;
  error?: ApiError | null;
  isLoading?: boolean;
  isFetching?: boolean;
}

export function Dashboard({ data, query, onQueryChange, onExport, error, isLoading, isFetching }: DashboardProps) {
  return (
    <section className="mx-auto flex max-w-5xl flex-col gap-4 p-4 md:p-6" aria-label="Panel de validación de muestras">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <label htmlFor="buscar-muestra" className="sr-only">
          Buscar por código de muestra
        </label>
        <div className="relative flex-1">
          <input
            id="buscar-muestra"
            type="search"
            placeholder="Buscar por código de muestra..."
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            maxLength={MAX_QUERY_LENGTH}
            className={`w-full rounded-lg border border-gray-300 py-2 pl-3 pr-9 text-sm text-gray-900 placeholder:text-gray-400 ${FOCUS_RING}`}
          />
          {isFetching && (
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
              <IconoCargando />
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onExport}
          className={`rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-hover ${FOCUS_RING}`}
        >
          Exportar a Excel
        </button>
      </header>

      {error ? (
        <div role="alert" className="rounded-lg border border-danger bg-danger-bg px-4 py-3 text-sm text-danger">
          {error.friendlyMessage}
        </div>
      ) : (
        <>
          {data.alertas_desfase.length > 0 && (
            <div className="rounded-lg border border-warning bg-warning-bg px-4 py-3 text-sm text-amber-900">
              Archivos desactualizados: {data.alertas_desfase.join(", ")}
            </div>
          )}

          {data.errores_validacion.length > 0 && (
            <div role="alert" className="rounded-lg border border-warning bg-warning-bg px-4 py-3 text-sm text-amber-900">
              {data.errores_validacion.length} fila(s) descartada(s) por datos inválidos:{" "}
              {data.errores_validacion.join("; ")}
            </div>
          )}

          <div
            role="region"
            aria-label="Resultados de la búsqueda"
            aria-busy={isLoading || undefined}
            className="overflow-hidden rounded-lg border border-gray-200"
          >
            <div className={`${FILA_GRID} border-b border-gray-200 bg-gray-50 text-sm font-semibold text-gray-700`}>
              <span>Muestra</span>
              <span>Estado</span>
              <span>Detalle</span>
            </div>
            {isLoading ? (
              <TablaSkeleton />
            ) : data.muestras.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-gray-500">
                No se encontraron muestras. Probá con otro código.
              </div>
            ) : (
              <List
                rowComponent={Fila}
                rowCount={data.muestras.length}
                rowHeight={ROW_HEIGHT}
                rowProps={{ muestras: data.muestras }}
                defaultHeight={Math.min(data.muestras.length * ROW_HEIGHT, 480) || ROW_HEIGHT}
              />
            )}
          </div>
        </>
      )}
    </section>
  );
}
