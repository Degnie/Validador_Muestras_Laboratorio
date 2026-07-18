import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { Dashboard } from "../components/Dashboard";
import { useDebounce } from "../hooks/useDebounce";
import { exportDashboard, fetchDashboard } from "../services/api";
import { triggerDownload } from "../utils/download";

export function DashboardPage() {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 300);

  const { data, error, isPending } = useQuery({
    queryKey: ["muestras", debouncedQuery],
    queryFn: () => fetchDashboard(debouncedQuery),
  });

  async function handleExport() {
    const blob = await exportDashboard();
    triggerDownload(blob, "validacion_muestras.xlsx");
  }

  if (error) return <p role="alert">{(error as Error).message}</p>;
  if (isPending) return <p>Cargando...</p>;

  return <Dashboard data={data} query={query} onQueryChange={setQuery} onExport={handleExport} />;
}
