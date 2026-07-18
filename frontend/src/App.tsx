import { QueryClientProvider } from "@tanstack/react-query";
import { lazy, Suspense } from "react";

import { ErrorBoundary } from "./components/ErrorBoundary";
import { ToastProvider } from "./components/Toast";
import { queryClient } from "./services/queryClient";

// Única "ruta" de la app hoy, pero el code-splitting vale igual: separa el bundle del
// dashboard (React Query + react-window + toda la lógica de negocio del cliente) del shell
// inicial (header, providers), así el HTML inicial pinta antes de que llegue ese JS.
const DashboardPage = lazy(() => import("./pages/DashboardPage").then((m) => ({ default: m.DashboardPage })));

function PageSkeleton() {
  return (
    <div aria-hidden="true" className="mx-auto max-w-5xl animate-pulse p-4 md:p-6">
      <div className="mb-4 h-10 rounded-lg bg-gray-200" />
      <div className="h-64 rounded-lg bg-gray-100" />
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <ErrorBoundary>
          <div className="min-h-screen bg-gray-50">
            <header className="border-b border-gray-200 bg-white px-4 py-4 md:px-6">
              <h1 className="text-lg font-semibold text-gray-900">
                Validador Centralizado de Muestras de Laboratorio
              </h1>
            </header>
            <main>
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
