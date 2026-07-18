import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { Dashboard } from "../components/Dashboard";
import { useDebounce } from "../hooks/useDebounce";
import { ApiError, exportDashboard, fetchDashboard } from "../services/api";
import type { DashboardResponse } from "../types/muestra";
import { triggerDownload } from "../utils/download";

const DASHBOARD_VACIO: DashboardResponse = { muestras: [], alertas_desfase: [] };

export function DashboardPage() {
  const [query, setQuery] = useState("");
  const [exportError, setExportError] = useState<ApiError | null>(null);
  const debouncedQuery = useDebounce(query, 300);

  const { data, error, isPending } = useQuery({
    queryKey: ["muestras", debouncedQuery],
    queryFn: () => fetchDashboard(debouncedQuery),
  });

  async function handleExport() {
    setExportError(null);
    try {
      const blob = await exportDashboard();
      triggerDownload(blob, "validacion_muestras.xlsx");
    } catch (err) {
      setExportError(err instanceof ApiError ? err : new ApiError(0, "Error al exportar"));
    }
  }

  if (isPending) return <p>Cargando...</p>;

  return (
    <>
      <Dashboard
        data={data ?? DASHBOARD_VACIO}
        query={query}
        onQueryChange={setQuery}
        onExport={handleExport}
        error={error instanceof ApiError ? error : null}
      />
      {exportError && <p role="alert">{exportError.friendlyMessage}</p>}
    </>
  );
}
