import { useToast } from "./Toast";
import type { AlertaActiva } from "../hooks/useAlertas";
import { ApiError, exportAlertasPendientes } from "../services/api";
import { triggerDownload } from "../utils/download";

const FECHA_FORMAT = new Intl.DateTimeFormat("es-PE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const FOCUS_RING =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

function IconoActualizar({ girando }: { girando: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      className={`h-4 w-4 ${girando ? "animate-spin" : ""}`}
      aria-hidden="true"
    >
      <path d="M15.312 4.63a7 7 0 10.502 8.98.75.75 0 111.19.91 8.5 8.5 0 11-.615-10.966l.66-.66a.5.5 0 01.854.354V7a.5.5 0 01-.5.5h-4.782a.5.5 0 01-.353-.854l1.044-1.045z" />
    </svg>
  );
}

function IconoFlechaAtras() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z"
        clipRule="evenodd"
      />
    </svg>
  );
}

interface AlertasPanelProps {
  listaAlertas: AlertaActiva[];
  onVolver: () => void;
  onActualizar: () => void;
  isFetching?: boolean;
}

export function AlertasPanel({ listaAlertas, onVolver, onActualizar, isFetching }: AlertasPanelProps) {
  const { showToast } = useToast();

  async function handleExportar() {
    try {
      const blob = await exportAlertasPendientes(listaAlertas);
      triggerDownload(blob, "alertas_pendientes.xlsx");
    } catch (err) {
      const apiError = err instanceof ApiError ? err : new ApiError(0, "Error al exportar");
      showToast(apiError.friendlyMessage, "error");
    }
  }

  return (
    <section
      className="mx-auto flex max-w-5xl flex-col border border-line bg-surface p-4 md:p-6"
      aria-label="Panel de alertas pendientes"
    >
      <header className="flex flex-col gap-4 border-b-2 border-ink pb-4">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
          <div>
            <p className="font-display text-[0.6875rem] font-bold tracking-[0.14em] text-ink-soft uppercase">
              Laboratorio · Área final
            </p>
            <h1 className="font-display text-lg font-extrabold tracking-tight text-ink sm:text-xl">Alertas pendientes</h1>
          </div>
          <p className="font-mono text-[0.8rem] text-ink-soft tabular-nums sm:text-right">
            <strong className="font-semibold text-ink">{listaAlertas.length}</strong> prueba(s) todavía sin completar
          </p>
        </div>

        <div className="flex flex-wrap gap-2.5">
          <button
            type="button"
            onClick={onVolver}
            className={`inline-flex items-center gap-1.5 border border-line-strong bg-transparent px-4 py-2 font-display text-[0.8125rem] font-bold tracking-wide text-ink uppercase hover:bg-paper ${FOCUS_RING}`}
          >
            <IconoFlechaAtras />
            Volver al panel principal
          </button>
          <button
            type="button"
            onClick={onActualizar}
            aria-busy={isFetching || undefined}
            className={`inline-flex items-center gap-1.5 border border-line-strong bg-transparent px-4 py-2 font-display text-[0.8125rem] font-bold tracking-wide text-ink uppercase hover:bg-paper ${FOCUS_RING}`}
          >
            <IconoActualizar girando={Boolean(isFetching)} />
            Actualizar
          </button>
          <button
            type="button"
            onClick={() => void handleExportar()}
            disabled={listaAlertas.length === 0}
            className={`border border-primary bg-primary px-4 py-2 font-display text-[0.8125rem] font-bold tracking-wide text-white uppercase hover:bg-primary-hover disabled:cursor-not-allowed disabled:border-line-strong disabled:bg-line-strong ${FOCUS_RING}`}
          >
            Exportar a Excel
          </button>
        </div>
      </header>

      <div className="mt-4 overflow-hidden border border-line">
        <div className="grid grid-cols-[140px_1fr_160px] items-center gap-2 border-b border-line-strong bg-paper px-3 py-2 font-display text-[0.6875rem] font-bold tracking-widest text-ink-soft uppercase">
          <span>Muestra</span>
          <span>Prueba pendiente</span>
          <span>Alerta creada</span>
        </div>

        {listaAlertas.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-ink-soft">
            No hay alertas pendientes: todo lo que se marcó ya se completó y fue notificado.
          </div>
        ) : (
          <div className="max-h-[480px] overflow-y-auto">
            {listaAlertas.map((a) => (
              <div
                key={`${a.id_muestra}::${a.prueba}`}
                className="grid grid-cols-[140px_1fr_160px] items-center gap-2 border-b border-line px-3 py-2 text-sm"
              >
                <span className="font-mono font-semibold text-ink">{a.id_muestra}</span>
                <span className="text-ink">{a.prueba}</span>
                <span className="font-mono text-ink-soft tabular-nums">{FECHA_FORMAT.format(new Date(a.creada))}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
