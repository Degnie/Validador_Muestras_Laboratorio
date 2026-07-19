import { QueryClientProvider } from "@tanstack/react-query";
import { lazy, Suspense } from "react";

import { ErrorBoundary } from "./components/ErrorBoundary";
import { ToastProvider } from "./components/Toast";
import { queryClient } from "./services/queryClient";

// Única "ruta" de la app hoy, pero el code-splitting vale igual: separa el bundle del
// dashboard (React Query + react-window + toda la lógica de negocio del cliente) del shell
// inicial (header, providers), así el HTML inicial pinta antes de que llegue ese JS.
const DashboardPage = lazy(() => import("./pages/DashboardPage").then((m) => ({ default: m.DashboardPage })));

// El título vive en Dashboard.tsx (dentro del mismo "sheet" que la búsqueda y la tabla,
// para que se lea como una sola hoja -- ver el prototipo). Este skeleton es lo único que
// se pinta antes de que cargue el bundle lazy, así que reproduce el mismo marco de borde.
function PageSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="mx-auto max-w-5xl animate-pulse border border-line bg-surface p-4 md:p-6"
    >
      <div className="mb-4 h-14 border-b-2 border-line" />
      <div className="h-64 bg-paper" />
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <ErrorBoundary>
          <div className="min-h-screen bg-paper">
            <main className="p-4 md:p-6">
              <Suspense fallback={<PageSkeleton />}>
                <DashboardPage />
              </Suspense>
            </main>
          </div>
        </ErrorBoundary>
      </ToastProvider>
    </QueryClientProvider>
  );
}
