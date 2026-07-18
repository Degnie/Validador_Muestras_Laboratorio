import { QueryClientProvider } from "@tanstack/react-query";

import { ErrorBoundary } from "./components/ErrorBoundary";
import { DashboardPage } from "./pages/DashboardPage";
import { queryClient } from "./services/queryClient";

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <main>
          <h1>Validador Centralizado de Muestras de Laboratorio</h1>
          <DashboardPage />
        </main>
      </ErrorBoundary>
    </QueryClientProvider>
  );
}
