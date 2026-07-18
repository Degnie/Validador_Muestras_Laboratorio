import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { DashboardPage } from "./pages/DashboardPage";

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <main>
        <h1>Validador Centralizado de Muestras de Laboratorio</h1>
        <DashboardPage />
      </main>
    </QueryClientProvider>
  );
}
