import { useEffect, useState } from "react";
import { List, type RowComponentProps } from "react-window";

import type { ApiError } from "../services/api";
import type { DashboardResponse, EstadoMuestra, MuestraEstado } from "../types/muestra";

const SYNC_TIME_FORMAT = new Intl.DateTimeFormat("es-PE", { hour: "2-digit", minute: "2-digit" });

// Etiqueta de estado en rectángulo recto (sin rotación de "sello" -- se ve poco prolijo
// en una tabla densa): reutiliza los mismos tokens semánticos que ya gobiernan los banners
// de alerta (bg-danger-bg antes solo se usaba para errores de red, ahora también para
// "Pruebas Fantasma" -- ambos son variantes de "algo anómalo").
const ESTADO_CLASS: Record<EstadoMuestra, string> = {
  Completo: "border-success bg-success-bg text-success",
  Faltante: "border-warning bg-warning-bg text-warning",
  "Pruebas Fantasma": "border-danger bg-danger-bg text-danger",
};

const ROW_HEIGHT_COMODA = 44;
const ROW_HEIGHT_COMPACTA = 32;
const SKELETON_ROW_COUNT = 8;

// Debe coincidir con MAX_QUERY_LENGTH en backend/app/services/fuzzy_match.py -- el backend ya
// trunca por seguridad, esto es solo para no dejar que el usuario escriba de más sin avisarle.
const MAX_QUERY_LENGTH = 200;

const FILA_GRID_BASE = "grid grid-cols-[140px_180px_1fr] items-center gap-2 px-3";
function filaGrid(compacta: boolean): string {
  return `${FILA_GRID_BASE} ${compacta ? "py-1" : "py-2"}`;
}
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

function Fila({ index, style, muestras, compacta }: RowComponentProps<{ muestras: MuestraEstado[]; compacta: boolean }>) {
  const muestra = muestras[index];
  const Icono = ESTADO_ICON[muestra.estado];
  return (
    <div className={`${filaGrid(compacta)} border-b border-line text-sm hover:bg-primary/5`} style={style}>
      <span className="font-mono font-semibold text-ink">{muestra.id_muestra}</span>
      <span>
        <span
          className={`inline-flex items-center gap-1 border-2 px-2.5 py-0.5 font-display text-[0.6875rem] font-extrabold tracking-wide uppercase ${ESTADO_CLASS[muestra.estado]}`}
        >
          <Icono />
          {muestra.estado}
        </span>
      </span>
      <span className="truncate text-ink-soft">{detalle(muestra)}</span>
    </div>
  );
}

function TablaSkeleton({ compacta }: { compacta: boolean }) {
  return (
    <div aria-hidden="true" className="animate-pulse divide-y divide-line">
      {Array.from({ length: SKELETON_ROW_COUNT }, (_, i) => (
        <div key={i} className={filaGrid(compacta)}>
          <span className="h-4 w-20 bg-line" />
          <span className="h-5 w-24 bg-line" />
          <span className="h-4 w-40 bg-line" />
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
  const [compacta, setCompacta] = useState(false);
  const [ultimaSync, setUltimaSync] = useState<Date | null>(null);

  // "Última sincronización" real: se pisa cada vez que llega una respuesta nueva del
  // servidor (carga inicial o una búsqueda), no un timestamp inventado como en el prototipo.
  useEffect(() => {
    if (!isLoading) setUltimaSync(new Date());
  }, [data, isLoading]);

  return (
    <section
      className="mx-auto flex max-w-5xl flex-col border border-line bg-surface p-4 md:p-6"
      aria-label="Panel de validación de muestras"
    >
      <header className="flex flex-col gap-4 border-b-2 border-ink pb-4">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
          <div>
            <p className="font-display text-[0.6875rem] font-bold tracking-[0.14em] text-ink-soft uppercase">
              Laboratorio · Área final
            </p>
            <h1 className="font-display text-lg font-extrabold tracking-tight text-ink sm:text-xl">
              Validador Centralizado de Muestras de Laboratorio
            </h1>
          </div>
          <p className="font-mono text-[0.8rem] text-ink-soft tabular-nums sm:text-right">
            <strong className="font-semibold text-ink">{data.muestras.length}</strong> muestras registradas
            <br />
            {ultimaSync ? `última sincronización ${SYNC_TIME_FORMAT.format(ultimaSync)}` : "sincronizando…"}
          </p>
        </div>

        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-stretch">
          <label htmlFor="buscar-muestra" className="sr-only">
            Buscar por código de muestra
          </label>
          <div className="relative flex-1">
            <input
              id="buscar-muestra"
              name="buscar-muestra"
              type="search"
              placeholder="Buscar por código de muestra..."
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              maxLength={MAX_QUERY_LENGTH}
              spellCheck={false}
              inputMode="search"
              className={`w-full border border-line-strong bg-paper py-2 pl-3 pr-9 font-mono text-sm text-ink placeholder:text-ink-soft ${FOCUS_RING}`}
            />
            {isFetching && (
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
                <IconoCargando />
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => setCompacta((c) => !c)}
            aria-pressed={compacta}
            className={`border px-4 py-2 font-display text-[0.8125rem] font-bold tracking-wide uppercase ${FOCUS_RING} ${
              compacta ? "border-primary bg-primary/10 text-ink" : "border-line-strong bg-transparent text-ink hover:bg-paper"
            }`}
          >
            {compacta ? "Vista cómoda" : "Vista compacta"}
          </button>
          <button
            type="button"
            onClick={onExport}
            className={`border border-primary bg-primary px-4 py-2 font-display text-[0.8125rem] font-bold tracking-wide text-white uppercase hover:bg-primary-hover ${FOCUS_RING}`}
          >
            Exportar a Excel
          </button>
        </div>
      </header>

      {error ? (
        <div role="alert" className="mt-4 border border-danger bg-danger-bg px-4 py-3 text-sm text-danger">
          {error.friendlyMessage}
        </div>
      ) : (
        <>
          {data.alertas_desfase.length > 0 && (
            <div className="mt-4 border border-warning bg-warning-bg px-4 py-3 text-sm text-warning">
              Archivos desactualizados: {data.alertas_desfase.join(", ")}
            </div>
          )}

          {data.errores_validacion.length > 0 && (
            <div role="alert" className="mt-4 border border-danger bg-danger-bg px-4 py-3 text-sm text-danger">
              {data.errores_validacion.length} fila(s) descartada(s) por datos inválidos:{" "}
              {data.errores_validacion.join("; ")}
            </div>
          )}

          <div
            role="region"
            aria-label="Resultados de la búsqueda"
            aria-busy={isLoading || undefined}
            className="mt-4 overflow-hidden border border-line"
          >
            <div
              className={`${filaGrid(compacta)} border-b border-line-strong bg-paper font-display text-[0.6875rem] font-bold tracking-widest text-ink-soft uppercase`}
            >
              <span>Muestra</span>
              <span>Estado</span>
              <span>Detalle</span>
            </div>
            {isLoading ? (
              <TablaSkeleton compacta={compacta} />
            ) : data.muestras.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-ink-soft">
                No se encontraron muestras. Probá con otro código.
              </div>
            ) : (
              <List
                rowComponent={Fila}
                rowCount={data.muestras.length}
                rowHeight={compacta ? ROW_HEIGHT_COMPACTA : ROW_HEIGHT_COMODA}
                rowProps={{ muestras: data.muestras, compacta }}
                defaultHeight={Math.min(
                  data.muestras.length * (compacta ? ROW_HEIGHT_COMPACTA : ROW_HEIGHT_COMODA),
                  480,
                ) || ROW_HEIGHT_COMODA}
              />
            )}
          </div>
        </>
      )}
    </section>
  );
}
