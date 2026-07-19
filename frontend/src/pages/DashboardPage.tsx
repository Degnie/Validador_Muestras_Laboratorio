import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import { AlertasPanel } from "../components/AlertasPanel";
import { Dashboard } from "../components/Dashboard";
import { useToast } from "../components/Toast";
import { useAlertas } from "../hooks/useAlertas";
import { useDebounce } from "../hooks/useDebounce";
import { useNotificaciones } from "../hooks/useNotificaciones";
import { ApiError, exportDashboard, fetchDashboard, postNotificacion } from "../services/api";
import type { DashboardResponse } from "../types/muestra";
import { triggerDownload } from "../utils/download";

const DASHBOARD_VACIO: DashboardResponse = { muestras: [], alertas_desfase: [], errores_validacion: [] };

export function DashboardPage() {
  const [query, setQuery] = useState("");
  const [vista, setVista] = useState<"dashboard" | "alertas">("dashboard");
  const debouncedQuery = useDebounce(query, 300);
  const { showToast, dismissToast } = useToast();
  const exportToastId = useRef<number | null>(null);
  const { listaAlertas, tieneAlerta, crearAlerta, resolverAlerta } = useAlertas();
  const { notificaciones, noLeidas, agregarNotificacion, marcarTodasLeidas } = useNotificaciones();

  const { data, error, isPending, isFetching, refetch } = useQuery({
    queryKey: ["muestras", debouncedQuery],
    // El signal lo provee y aborta React Query (al desmontar o al quedar obsoleta la query
    // por un nuevo debouncedQuery), no un AbortController manual.
    queryFn: ({ signal }) => fetchDashboard(debouncedQuery, signal),
    // Sin esto, cada debouncedQuery nuevo es un queryKey sin datos cacheados -> isPending
    // vuelve a true -> Dashboard mostraría el skeleton en cada letra en vez de solo en la
    // carga inicial. keepPreviousData mantiene la tabla anterior mientras llega la respuesta
    // nueva, así el input (y el foco) nunca se destruyen entre letras.
    placeholderData: keepPreviousData,
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

  if (vista === "alertas") {
    return (
      <AlertasPanel
        listaAlertas={listaAlertas}
        onVolver={() => setVista("dashboard")}
        onActualizar={() => void refetch()}
        isFetching={isFetching}
      />
    );
  }

  return (
    <Dashboard
      data={data ?? DASHBOARD_VACIO}
      query={query}
      onQueryChange={setQuery}
      onExport={handleExport}
      error={error instanceof ApiError ? error : null}
      isLoading={isPending}
      isFetching={isFetching}
      tieneAlerta={tieneAlerta}
      onCrearAlerta={handleCrearAlerta}
      notificaciones={notificaciones}
      noLeidas={noLeidas}
      onAbrirNotificaciones={marcarTodasLeidas}
      onActualizar={() => void refetch()}
      alertasPendientesCount={listaAlertas.length}
      onVerAlertas={() => setVista("alertas")}
    />
  );
}
