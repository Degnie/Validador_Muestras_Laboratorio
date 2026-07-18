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

function detalle(muestra: MuestraEstado): string {
  const partes = [];
  if (muestra.pruebas_faltantes.length > 0) partes.push(`Faltan: ${muestra.pruebas_faltantes.join(", ")}`);
  if (muestra.pruebas_fantasma.length > 0) partes.push(`Fantasma: ${muestra.pruebas_fantasma.join(", ")}`);
  return partes.join(" ");
}

function Fila({ index, style, muestras }: RowComponentProps<{ muestras: MuestraEstado[] }>) {
  const muestra = muestras[index];
  return (
    <div className={`${FILA_GRID} border-b border-gray-100 text-sm hover:bg-gray-50`} style={style}>
      <span className="font-medium text-gray-900">{muestra.id_muestra}</span>
      <span>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${ESTADO_CLASS[muestra.estado]}`}>
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
}

export function Dashboard({ data, query, onQueryChange, onExport, error, isLoading }: DashboardProps) {
  return (
    <section className="mx-auto flex max-w-5xl flex-col gap-4 p-4 md:p-6" aria-label="Panel de validación de muestras">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <label htmlFor="buscar-muestra" className="sr-only">
          Buscar por código de muestra
        </label>
        <input
          id="buscar-muestra"
          type="search"
          placeholder="Buscar por código de muestra..."
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          maxLength={MAX_QUERY_LENGTH}
          className={`flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 ${FOCUS_RING}`}
        />
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
