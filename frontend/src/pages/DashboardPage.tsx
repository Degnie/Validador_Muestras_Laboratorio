import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";

import { Dashboard } from "../components/Dashboard";
import { useToast } from "../components/Toast";
import { useDebounce } from "../hooks/useDebounce";
import { ApiError, exportDashboard, fetchDashboard } from "../services/api";
import type { DashboardResponse } from "../types/muestra";
import { triggerDownload } from "../utils/download";

const DASHBOARD_VACIO: DashboardResponse = { muestras: [], alertas_desfase: [], errores_validacion: [] };

export function DashboardPage() {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 300);
  const { showToast, dismissToast } = useToast();
  const exportToastId = useRef<number | null>(null);

  const { data, error, isPending, isFetching } = useQuery({
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
    <Dashboard
      data={data ?? DASHBOARD_VACIO}
      query={query}
      onQueryChange={setQuery}
      onExport={handleExport}
      error={error instanceof ApiError ? error : null}
      isLoading={isPending}
      isFetching={isFetching}
    />
  );
}
