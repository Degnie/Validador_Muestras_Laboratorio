import { useState } from "react";

import type { Notificacion } from "../hooks/useNotificaciones";
import { NotificationBell } from "./NotificationBell";
import type { ApiError } from "../services/api";
import type { DashboardResponse, EstadoMuestra, MuestraEstado } from "../types/muestra";

const SYNC_TIME_FORMAT = new Intl.DateTimeFormat("es-PE", { hour: "2-digit", minute: "2-digit" });

// Etiqueta visible al usuario, separada del valor interno del contrato de la API
// (EstadoMuestra) -- "Pruebas Fantasma" es el nombre que sigue mandando el backend, pero se
// muestra como "Pruebas Adicionales" (más claro: no es un error de datos, es una prueba de
// más que nadie pidió).
const ESTADO_LABEL: Record<EstadoMuestra, string> = {
  Completo: "Completo",
  Faltante: "Faltante",
  "Pruebas Fantasma": "Pruebas Adicionales",
};

// Faltante = rojo (algo pedido que no se hizo); Pruebas Adicionales = naranja (una prueba de
// más, no un error de datos, pero sí algo a revisar).
const ESTADO_CLASS: Record<EstadoMuestra, string> = {
  Completo: "border-success bg-success-bg text-success",
  Faltante: "border-danger bg-danger-bg text-danger",
  "Pruebas Fantasma": "border-warning bg-warning-bg text-warning",
};

// ID del <symbol> del sprite (ver EstadoIconSprite) para cada estado -- se referencia con
// <use> en vez de repetir el <path> completo en cada fila de la tabla.
const ESTADO_ICON_ID: Record<EstadoMuestra, string> = {
  Completo: "icono-completo",
  Faltante: "icono-faltante",
  "Pruebas Fantasma": "icono-adicional",
};

const SKELETON_ROW_COUNT = 8;

// Debe coincidir con MAX_QUERY_LENGTH en backend/app/services/fuzzy_match.py -- el backend ya
// trunca por seguridad, esto es solo para no dejar que el usuario escriba de más sin avisarle.
const MAX_QUERY_LENGTH = 200;

const FILA_GRID = "grid grid-cols-[140px_180px_1fr] items-center gap-2 px-3 py-2";
const FOCUS_RING =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

// Sprite de los 3 íconos de estado (trazos de Heroicons v2 -- MIT): un solo <symbol> por
// ícono, renderizado una vez y oculto (no ocupa layout), referenciado por cada fila con
// <use>. Con decenas de filas en pantalla, esto evita repetir el mismo <path> completo una
// vez por fila -- el DOM de la tabla queda con un <use> liviano en vez de un <svg> con path
// duplicado por cada muestra.
function EstadoIconSprite() {
  return (
    <svg aria-hidden="true" className="hidden">
      <symbol id="icono-completo" viewBox="0 0 20 20" fill="currentColor">
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
          clipRule="evenodd"
        />
      </symbol>
      <symbol id="icono-faltante" viewBox="0 0 20 20" fill="currentColor">
        <path
          fillRule="evenodd"
          d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.19-1.458-1.515-2.625L8.485 2.495zM10 6a.75.75 0 01.75.75v3a.75.75 0 01-1.5 0v-3A.75.75 0 0110 6zm0 8a.9.9 0 100-1.8.9.9 0 000 1.8z"
          clipRule="evenodd"
        />
      </symbol>
      <symbol id="icono-adicional" viewBox="0 0 20 20" fill="currentColor">
        <path d="M10 6a2 2 0 100 4 2 2 0 000-4z" />
        <path
          fillRule="evenodd"
          d="M.664 10.59a1.651 1.651 0 010-1.186A10.004 10.004 0 0110 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0110 17c-4.257 0-7.893-2.66-9.336-6.41zM14 10a4 4 0 11-8 0 4 4 0 018 0z"
          clipRule="evenodd"
        />
      </symbol>
    </svg>
  );
}

function IconoEstado({ estado }: { estado: EstadoMuestra }) {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0" aria-hidden="true">
      <use href={`#${ESTADO_ICON_ID[estado]}`} />
    </svg>
  );
}

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

function IconoActualizar({ girando }: { girando: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      className={`h-4 w-4 ${girando ? "motion-safe:animate-spin" : ""}`}
      aria-hidden="true"
    >
      <path d="M15.312 4.63a7 7 0 10.502 8.98.75.75 0 111.19.91 8.5 8.5 0 11-.615-10.966l.66-.66a.5.5 0 01.854.354V7a.5.5 0 01-.5.5h-4.782a.5.5 0 01-.353-.854l1.044-1.045z" />
    </svg>
  );
}

function IconoListaAlertas() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M2 4.75A2.75 2.75 0 014.75 2h10.5A2.75 2.75 0 0118 4.75v10.5A2.75 2.75 0 0115.25 18H4.75A2.75 2.75 0 012 15.25V4.75zM5 7a1 1 0 011-1h1a1 1 0 110 2H6a1 1 0 01-1-1zm4-1a1 1 0 100 2h5a1 1 0 100-2H9zM5 12a1 1 0 011-1h1a1 1 0 110 2H6a1 1 0 01-1-1zm4-1a1 1 0 100 2h5a1 1 0 100-2H9z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function IconoContraer() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M14.77 12.79a.75.75 0 01-1.06-.02L10 8.832 6.29 12.77a.75.75 0 11-1.08-1.04l4.25-4.5a.75.75 0 011.08 0l4.25 4.5a.75.75 0 01-.02 1.06z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function IconoCampana({ activa }: { activa: boolean }) {
  return (
    <svg viewBox="0 0 20 20" fill={activa ? "currentColor" : "none"} stroke="currentColor" strokeWidth={activa ? 0 : 1.5} className="h-4 w-4" aria-hidden="true">
      <path d="M10 2a6 6 0 00-6 6v2.586l-1.707 1.707A1 1 0 003 14h14a1 1 0 00.707-1.707L16 10.586V8a6 6 0 00-6-6zM8.5 16a1.5 1.5 0 003 0h-3z" />
    </svg>
  );
}

function detalle(muestra: MuestraEstado): string {
  const partes = [];
  if (muestra.pruebas_faltantes.length > 0) partes.push(`Faltan: ${muestra.pruebas_faltantes.join(", ")}`);
  if (muestra.pruebas_fantasma.length > 0) partes.push(`Adicionales: ${muestra.pruebas_fantasma.join(", ")}`);
  return partes.join(" ");
}

// El backend no manda una lista aparte de "pruebas exigidas" -- se reconstruye acá: toda
// prueba realizada que no sea fantasma es exigida, más las que faltan por completo.
function nombresExigidos(muestra: MuestraEstado): string[] {
  const realizadasExigidas = muestra.pruebas
    .map((p) => p.nombre_prueba)
    .filter((nombre) => !muestra.pruebas_fantasma.includes(nombre));
  return [...new Set([...realizadasExigidas, ...muestra.pruebas_faltantes])].sort();
}

function idPanelDetalle(id_muestra: string): string {
  return `detalle-${id_muestra}`;
}

interface FilaProps {
  muestra: MuestraEstado;
  expandida: boolean;
  onToggleExpand: (id_muestra: string) => void;
}

function Fila({ muestra, expandida, onToggleExpand }: FilaProps) {
  return (
    <div className={`${FILA_GRID} border-b border-line text-sm hover:bg-primary/5`}>
      <button
        type="button"
        onClick={() => onToggleExpand(muestra.id_muestra)}
        aria-expanded={expandida}
        aria-controls={idPanelDetalle(muestra.id_muestra)}
        className="truncate text-left font-mono font-semibold text-ink underline decoration-dotted underline-offset-2 hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        {muestra.id_muestra}
      </button>
      <span>
        <span
          className={`inline-flex items-center gap-1 border-2 px-2.5 py-0.5 font-display text-[0.6875rem] font-extrabold tracking-wide uppercase ${ESTADO_CLASS[muestra.estado]}`}
        >
          <IconoEstado estado={muestra.estado} />
          {ESTADO_LABEL[muestra.estado]}
        </span>
      </span>
      <span className="truncate text-ink-soft">{detalle(muestra)}</span>
    </div>
  );
}

interface DetalleMuestraProps {
  muestra: MuestraEstado;
  expandida: boolean;
  tieneAlerta: (id_muestra: string, prueba: string) => boolean;
  onCrearAlerta: (id_muestra: string, prueba: string) => void;
}

// Envuelve el contenido en un CSS Grid de una sola fila cuya altura (grid-template-rows) se
// anima entre 0fr (colapsado) y 1fr (abierto) -- una transición de "altura automática" real,
// sin medir el alto en JS. `overflow-hidden` en el wrapper interno es lo que hace que 0fr
// recorte el contenido en vez de mostrarlo comprimido.
function DetalleMuestra({ muestra, expandida, tieneAlerta, onCrearAlerta }: DetalleMuestraProps) {
  const exigidas = nombresExigidos(muestra);
  const porNombre = new Map(muestra.pruebas.map((p) => [p.nombre_prueba, p]));

  return (
    <div
      id={idPanelDetalle(muestra.id_muestra)}
      aria-hidden={!expandida}
      className="grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none"
      style={{ gridTemplateRows: expandida ? "1fr" : "0fr" }}
    >
      <div className="overflow-hidden">
        <div className="border-l-4 border-primary bg-surface px-4 py-3 text-sm shadow-sm">
          <p className="mb-2 font-display text-[0.6875rem] font-bold tracking-widest text-ink-soft uppercase">
            {muestra.id_muestra} · Tipo de análisis: <span className="text-ink">{muestra.tipo_analisis}</span>
          </p>
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-line-strong text-[0.6875rem] font-bold tracking-wide text-ink-soft uppercase">
                <th className="py-1 pr-2">Prueba</th>
                <th className="py-1 pr-2">Resultado</th>
                <th className="py-1 pr-2">Valor</th>
                <th className="py-1 pr-2">Técnico</th>
                <th className="py-1 pr-2">Fecha</th>
                <th className="py-1 pr-2">Alerta</th>
              </tr>
            </thead>
            <tbody>
              {exigidas.map((nombre) => {
                const encontrada = porNombre.get(nombre);
                const activa = tieneAlerta(muestra.id_muestra, nombre);
                return (
                  <tr key={nombre} className={`border-b border-line ${!encontrada ? "bg-danger-bg text-danger" : ""}`}>
                    <td className="py-1.5 pr-2 font-semibold">{nombre}</td>
                    <td className="py-1.5 pr-2">{encontrada ? encontrada.resultado : "Faltante"}</td>
                    <td className="py-1.5 pr-2">{encontrada?.valor ?? "—"}</td>
                    <td className="py-1.5 pr-2">{encontrada?.tecnico ?? "—"}</td>
                    <td className="py-1.5 pr-2">{encontrada?.fecha ?? "—"}</td>
                    <td className="py-1.5 pr-2">
                      {!encontrada && (
                        <button
                          type="button"
                          onClick={() => onCrearAlerta(muestra.id_muestra, nombre)}
                          aria-pressed={activa}
                          aria-label={`Avisarme cuando ${nombre} se complete para ${muestra.id_muestra}`}
                          className={`focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${activa ? "text-primary" : "text-danger hover:text-primary"}`}
                        >
                          <IconoCampana activa={activa} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {muestra.pruebas_fantasma.map((nombre) => {
                const encontrada = porNombre.get(nombre);
                return (
                  <tr key={nombre} className="border-b border-line bg-warning-bg text-warning">
                    <td className="py-1.5 pr-2 font-semibold">{nombre} (adicional)</td>
                    <td className="py-1.5 pr-2">{encontrada?.resultado ?? "—"}</td>
                    <td className="py-1.5 pr-2">{encontrada?.valor ?? "—"}</td>
                    <td className="py-1.5 pr-2">{encontrada?.tecnico ?? "—"}</td>
                    <td className="py-1.5 pr-2">{encontrada?.fecha ?? "—"}</td>
                    <td className="py-1.5 pr-2" />
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function TablaSkeleton() {
  return (
    <div aria-hidden="true" className="motion-safe:animate-pulse divide-y divide-line">
      {Array.from({ length: SKELETON_ROW_COUNT }, (_, i) => (
        <div key={i} className={FILA_GRID}>
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
  // Timestamp (`Date.now()`, tal cual lo expone `dataUpdatedAt` de React Query) de la última
  // respuesta exitosa -- no un estado derivado de la referencia de `data`. React Query hace
  // "structural sharing" por defecto: si un refetch en segundo plano (auto-refresh, botón
  // "Actualizar") trae el mismo contenido, `data` conserva la MISMA referencia y un
  // `useEffect` con `[data]` en las dependencias nunca se dispara, aunque sí hubo una
  // sincronización real. `dataUpdatedAt` sí cambia en cada fetch exitoso, tenga o no
  // contenido distinto.
  ultimaSyncTimestamp: number;
  tieneAlerta: (id_muestra: string, prueba: string) => boolean;
  onCrearAlerta: (id_muestra: string, prueba: string) => void;
  notificaciones: Notificacion[];
  noLeidas: number;
  onAbrirNotificaciones: () => void;
  onActualizar: () => void;
  alertasPendientesCount: number;
  onVerAlertas: () => void;
}

export function Dashboard({
  data,
  query,
  onQueryChange,
  onExport,
  error,
  isLoading,
  isFetching,
  ultimaSyncTimestamp,
  tieneAlerta,
  onCrearAlerta,
  notificaciones,
  noLeidas,
  onAbrirNotificaciones,
  onActualizar,
  alertasPendientesCount,
  onVerAlertas,
}: DashboardProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  function toggleExpand(id_muestra: string) {
    setExpandedId((current) => (current === id_muestra ? null : id_muestra));
  }

  return (
    <section
      className="mx-auto flex max-w-5xl flex-col border border-line bg-surface p-4 md:p-6"
      aria-label="Panel de validación de muestras"
    >
      <EstadoIconSprite />
      {/* z-20, más alto que el encabezado sticky de la tabla (z-10) más abajo: al ser un
          contenedor con posición/z-index propios, el header entero (incluido el desplegable
          del buzón de notificaciones que cuelga de él) es una única unidad de apilamiento --
          si quedara empatado en z-10 con el encabezado de la tabla, este último ganaría por
          venir después en el DOM y el buzón se vería "por debajo" de él al desplegarse. */}
      <header className="sticky top-0 z-20 flex flex-col gap-4 border-b-2 border-ink bg-surface pb-4">
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
            {ultimaSyncTimestamp
              ? `última sincronización ${SYNC_TIME_FORMAT.format(new Date(ultimaSyncTimestamp))}`
              : "sincronizando…"}
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
            onClick={() => setExpandedId(null)}
            disabled={expandedId === null}
            className={`inline-flex items-center gap-1.5 border border-line-strong bg-transparent px-4 py-2 font-display text-[0.8125rem] font-bold tracking-wide text-ink uppercase hover:bg-paper disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS_RING}`}
          >
            <IconoContraer />
            Contraer todo
          </button>
          <button
            type="button"
            onClick={onExport}
            className={`border border-primary bg-primary px-4 py-2 font-display text-[0.8125rem] font-bold tracking-wide text-white uppercase hover:bg-primary-hover ${FOCUS_RING}`}
          >
            Exportar a Excel
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
            onClick={onVerAlertas}
            className={`relative inline-flex items-center gap-1.5 border border-line-strong bg-transparent px-4 py-2 font-display text-[0.8125rem] font-bold tracking-wide text-ink uppercase hover:bg-paper ${FOCUS_RING}`}
          >
            <IconoListaAlertas />
            Alertas pendientes
            {alertasPendientesCount > 0 && (
              <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1 font-mono text-[0.6875rem] font-bold text-white">
                {alertasPendientesCount}
              </span>
            )}
          </button>
          <NotificationBell notificaciones={notificaciones} noLeidas={noLeidas} onAbrir={onAbrirNotificaciones} />
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
            className="mt-4 border border-line"
          >
            <div
              className={`${FILA_GRID} sticky top-0 z-10 border-b border-line-strong bg-paper font-display text-[0.6875rem] font-bold tracking-widest text-ink-soft uppercase`}
            >
              <span>Muestra</span>
              <span>Estado</span>
              <span>Detalle</span>
            </div>
            {isLoading ? (
              <TablaSkeleton />
            ) : data.muestras.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-ink-soft">
                No se encontraron muestras. Probá con otro código.
              </div>
            ) : (
              // Lista mapeada (no virtualizada): el panel de detalle se inserta justo debajo
              // de la fila que se expande, empujando el resto hacia abajo con el flujo normal
              // del documento. react-window no soporta bien alturas de fila variables, y para
              // el volumen de muestras que maneja esta app no se justifica reescribir la
              // virtualización -- si el dataset crece a miles de filas, retomar
              // virtualización con medición dinámica de altura.
              //
              // DetalleMuestra se monta siempre (no solo cuando está expandida): la
              // transición de grid-template-rows (0fr <-> 1fr) necesita que el elemento ya
              // esté en el DOM antes de cambiar de estado para poder animar tanto la
              // apertura como el cierre -- si se montara/desmontara condicionalmente, la
              // primera apertura no tendría desde dónde animar. Para el volumen de esta app
              // (decenas de filas) el costo de tener las N tablas de detalle colapsadas en
              // el DOM es aceptable; con miles de filas convendría montarla recién al primer
              // click y no volver a desmontarla.
              <div className="max-h-[520px] overflow-y-auto">
                {data.muestras.map((muestra) => (
                  <div key={muestra.id_muestra}>
                    <Fila
                      muestra={muestra}
                      expandida={expandedId === muestra.id_muestra}
                      onToggleExpand={toggleExpand}
                    />
                    <DetalleMuestra
                      muestra={muestra}
                      expandida={expandedId === muestra.id_muestra}
                      tieneAlerta={tieneAlerta}
                      onCrearAlerta={onCrearAlerta}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
