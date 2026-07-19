import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { lazy, Suspense, useEffect, useRef, useState } from "react";

import { Dashboard } from "../components/Dashboard";
import { useToast } from "../components/Toast";
import { useAlertas } from "../hooks/useAlertas";
import { useDebounce } from "../hooks/useDebounce";
import { useNotificaciones } from "../hooks/useNotificaciones";
import { ApiError, exportDashboard, fetchDashboard, postNotificacion } from "../services/api";
import type { DashboardResponse } from "../types/muestra";
import { triggerDownload } from "../utils/download";

// Aísla el peso de "Alertas pendientes" (su propia tabla, botones, export) del chunk inicial
// -- se pide igual (el panel queda siempre montado, ver más abajo), pero como un chunk
// separado que el navegador puede cachear aparte y que no infla el bundle que se parsea al
// arrancar la página.
const AlertasPanel = lazy(() => import("../components/AlertasPanel").then((m) => ({ default: m.AlertasPanel })));

const DASHBOARD_VACIO: DashboardResponse = { muestras: [], alertas_desfase: [], errores_validacion: [] };

// Auto-refresh: cada `_build_estados` del backend relee y revalida el Excel entero (streaming
// por lotes, pero igual O(filas)) y corre fuzzy matching sobre los IDs -- con datasets de
// hasta ~5000 muestras eso no es instantáneo. 60s es un intervalo prudente: suficientemente
// seguido para que una alerta se note sin demora exagerada, y suficientemente espaciado para
// no encadenar requests sobre el único worker de Gunicorn (WEB_CONCURRENCY=1, ver ADR-001) en
// el archivo más grande del rango. React Query no refetchea en segundo plano por defecto
// (`refetchIntervalInBackground` es `false`): con la pestaña sin foco, el polling se pausa.
const INTERVALO_AUTO_REFRESH_MS = 60_000;

export function DashboardPage() {
  const [query, setQuery] = useState("");
  const [vista, setVista] = useState<"dashboard" | "alertas">("dashboard");
  // Mientras el usuario tiene una muestra expandida (leyendo el detalle), un refresh en
  // segundo plano podría reordenar/actualizar la fila debajo suyo -- se pausa el polling
  // hasta que la cierre. `Dashboard` avisa este estado por callback, no lo sube entero.
  const [hayFilaExpandida, setHayFilaExpandida] = useState(false);
  const [anuncioSr, setAnuncioSr] = useState("");
  const debouncedQuery = useDebounce(query, 300);
  const { showToast, dismissToast } = useToast();
  const exportToastId = useRef<number | null>(null);
  const primeraCargaHecha = useRef(false);
  const { listaAlertas, tieneAlerta, crearAlerta, resolverAlerta } = useAlertas();
  const { notificaciones, noLeidas, agregarNotificacion, marcarTodasLeidas } = useNotificaciones();

  const { data, error, isPending, isFetching, dataUpdatedAt, refetch } = useQuery({
    queryKey: ["muestras", debouncedQuery],
    // El signal lo provee y aborta React Query (al desmontar o al quedar obsoleta la query
    // por un nuevo debouncedQuery), no un AbortController manual.
    queryFn: ({ signal }) => fetchDashboard(debouncedQuery, signal),
    // Sin esto, cada debouncedQuery nuevo es un queryKey sin datos cacheados -> isPending
    // vuelve a true -> Dashboard mostraría el skeleton en cada letra en vez de solo en la
    // carga inicial. keepPreviousData mantiene la tabla anterior mientras llega la respuesta
    // nueva, así el input (y el foco) nunca se destruyen entre letras.
    placeholderData: keepPreviousData,
    refetchInterval: hayFilaExpandida ? false : INTERVALO_AUTO_REFRESH_MS,
  });

  // Cada alerta activa es una prueba puntual (id_muestra + nombre) que el usuario marcó como
  // "avisame cuando esto se complete". No hace falta guardar una foto anterior: en cada
  // respuesta nueva (incluida una forzada con el botón "Actualizar"), si esa prueba ya no
  // aparece en pruebas_faltantes, se completó.
  useEffect(() => {
    if (!data) return;
    for (const { id_muestra, prueba } of listaAlertas) {
      const muestra = data.muestras.find((m) => m.id_muestra === id_muestra);
      if (!muestra || muestra.pruebas_faltantes.includes(prueba)) continue;

      agregarNotificacion(id_muestra, prueba);
      resolverAlerta(id_muestra, prueba);
      void postNotificacion(id_muestra, prueba);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  // Anuncio para lectores de pantalla cada vez que un fetch exitoso trae una respuesta nueva
  // (auto-refresh, "Actualizar" o una búsqueda) -- `dataUpdatedAt` cambia en cada éxito, tenga
  // o no contenido distinto (ver comentario en Dashboard.tsx sobre structural sharing). Se
  // salta la carga inicial: recién montado no hay "actualización" que anunciar todavía.
  useEffect(() => {
    if (!dataUpdatedAt) return;
    if (!primeraCargaHecha.current) {
      primeraCargaHecha.current = true;
      return;
    }
    setAnuncioSr(`Datos actualizados a las ${new Date(dataUpdatedAt).toLocaleTimeString("es-PE")}`);
  }, [dataUpdatedAt]);

  function handleCrearAlerta(id_muestra: string, prueba: string) {
    const creada = crearAlerta(id_muestra, prueba);
    if (!creada) {
      showToast("La alerta ya fue generada", "info");
    }
  }

  async function handleExport() {
    // Descarta el toast del intento anterior antes de mostrar el resultado del nuevo, para
    // que un reintento exitoso no deje un toast de error viejo colgado en pantalla.
    if (exportToastId.current !== null) {
      dismissToast(exportToastId.current);
      exportToastId.current = null;
    }
    try {
      const blob = await exportDashboard();
      triggerDownload(blob, "validacion_muestras.xlsx");
      exportToastId.current = showToast("Exportación completada correctamente.", "success");
    } catch (err) {
      const apiError = err instanceof ApiError ? err : new ApiError(0, "Error al exportar");
      exportToastId.current = showToast(apiError.friendlyMessage, "error");
    }
  }

  return (
    <>
      {/* aria-live: no se ve (sr-only), solo lo escucha un lector de pantalla cuando el
          texto cambia -- "polite" espera a que el usuario no esté en medio de otra lectura,
          no interrumpe como "assertive". */}
      <div aria-live="polite" className="sr-only">
        {anuncioSr}
      </div>

      {/* Los dos paneles quedan siempre montados; se alterna cuál se ve con la clase `hidden`
          en vez de renderizar uno u otro condicionalmente. Desmontar el Dashboard al pasar a
          "Alertas pendientes" perdía el scroll de la tabla y la fila expandida -- con
          `hidden`, el DOM (y ese estado) se conserva mientras el usuario va y vuelve entre
          vistas. */}
      <div hidden={vista !== "dashboard"}>
        <Dashboard
          data={data ?? DASHBOARD_VACIO}
          query={query}
          onQueryChange={setQuery}
          onExport={handleExport}
          error={error instanceof ApiError ? error : null}
          isLoading={isPending}
          isFetching={isFetching}
          ultimaSyncTimestamp={dataUpdatedAt}
          intervaloAutoRefreshMs={INTERVALO_AUTO_REFRESH_MS}
          autoRefreshPausado={hayFilaExpandida}
          onFilaExpandidaChange={setHayFilaExpandida}
          tieneAlerta={tieneAlerta}
          onCrearAlerta={handleCrearAlerta}
          notificaciones={notificaciones}
          noLeidas={noLeidas}
          onAbrirNotificaciones={marcarTodasLeidas}
          onActualizar={() => void refetch()}
          alertasPendientesCount={listaAlertas.length}
          onVerAlertas={() => setVista("alertas")}
        />
      </div>
      <div hidden={vista !== "alertas"}>
        <Suspense fallback={null}>
          <AlertasPanel
            listaAlertas={listaAlertas}
            onVolver={() => setVista("dashboard")}
            onActualizar={() => void refetch()}
            isFetching={isFetching}
          />
        </Suspense>
      </div>
    </>
  );
}
