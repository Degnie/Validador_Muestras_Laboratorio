import { useEffect, useState } from "react";

import { Dashboard } from "../components/Dashboard";
import { fetchDashboard } from "../services/api";
import type { DashboardResponse } from "../types/muestra";

export function DashboardPage() {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboard()
      .then(setData)
      .catch((err: Error) => setError(err.message));
  }, []);

  if (error) return <p role="alert">{error}</p>;
  if (!data) return <p>Cargando...</p>;
  return <Dashboard data={data} />;
}
