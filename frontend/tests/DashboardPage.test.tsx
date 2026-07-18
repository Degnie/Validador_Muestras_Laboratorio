import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DashboardPage } from "../src/pages/DashboardPage";
import { ApiError } from "../src/services/api";

vi.mock("../src/services/api", async () => {
  const actual = await vi.importActual<typeof import("../src/services/api")>(
    "../src/services/api",
  );
  return {
    ...actual,
    fetchDashboard: vi.fn(),
    exportDashboard: vi.fn(),
  };
});

import { exportDashboard, fetchDashboard } from "../src/services/api";

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <DashboardPage />
    </QueryClientProvider>,
  );
}

describe("DashboardPage", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders the dashboard once the data loads", async () => {
    vi.mocked(fetchDashboard).mockResolvedValue({
      muestras: [
        { id_muestra: "M-001", estado: "Completo", pruebas_faltantes: [], pruebas_fantasma: [] },
      ],
      alertas_desfase: [],
      errores_validacion: [],
    });

    renderPage();

    expect(await screen.findByText("M-001")).toBeInTheDocument();
  });

  it("shows a friendly banner when the network request fails outright", async () => {
    vi.mocked(fetchDashboard).mockRejectedValue(new ApiError(0, "network down"));

    renderPage();

    expect(await screen.findByRole("alert")).toHaveTextContent(/conexión/i);
  });

  it("shows a friendly banner on a 500 without leaking the raw error", async () => {
    vi.mocked(fetchDashboard).mockRejectedValue(new ApiError(500, "stack trace interno feo"));

    renderPage();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/servidor/i);
    expect(alert).not.toHaveTextContent("stack trace interno feo");
  });

  it("shows an export-specific error without losing the loaded table", async () => {
    vi.mocked(fetchDashboard).mockResolvedValue({
      muestras: [
        { id_muestra: "M-001", estado: "Completo", pruebas_faltantes: [], pruebas_fantasma: [] },
      ],
      alertas_desfase: [],
      errores_validacion: [],
    });
    vi.mocked(exportDashboard).mockRejectedValue(new ApiError(413, "muy grande"));

    renderPage();
    await screen.findByText("M-001");
    fireEvent.click(screen.getByRole("button", { name: /exportar/i }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/grande/i);
    expect(screen.getByText("M-001")).toBeInTheDocument(); // la tabla se mantiene visible
  });

  it("keeps focus on the search input and debounces the fetch while typing (regression)", async () => {
    vi.mocked(fetchDashboard).mockResolvedValue({ muestras: [], alertas_desfase: [], errores_validacion: [] });
    vi.useFakeTimers({ shouldAdvanceTime: true });

    renderPage();
    const input = await screen.findByPlaceholderText<HTMLInputElement>(/buscar por código/i);
    input.focus();
    expect(fetchDashboard).toHaveBeenCalledTimes(1); // carga inicial, sin query

    for (const char of "M-006") {
      fireEvent.change(input, { target: { value: input.value + char } });
      act(() => vi.advanceTimersByTime(50)); // más rápido que el debounce de 300ms
      expect(document.activeElement).toBe(input); // el input nunca se remonta
    }
    expect(fetchDashboard).toHaveBeenCalledTimes(1); // ninguna tecla disparó fetch todavía

    act(() => vi.advanceTimersByTime(300)); // recién ahora vence el debounce
    await vi.waitFor(() => expect(fetchDashboard).toHaveBeenCalledTimes(2));
    expect(fetchDashboard).toHaveBeenLastCalledWith("M-006", expect.anything());

    vi.useRealTimers();
  });

  it("keeps the search input mounted and focusable while a debounced query is still in flight (regression)", async () => {
    // Bug real reportado: con un mock que resuelve en el mismo tick, esta regresión no se ve
    // (el "Cargando..." dura menos que un microtask). Acá se deja la segunda consulta colgada
    // a propósito para poder observar el estado intermedio, como pasa con latencia de red real.
    let resolveSegundaConsulta: ((value: Awaited<ReturnType<typeof fetchDashboard>>) => void) | undefined;
    vi.mocked(fetchDashboard)
      .mockResolvedValueOnce({ muestras: [], alertas_desfase: [], errores_validacion: [] })
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveSegundaConsulta = resolve;
          }),
      );
    vi.useFakeTimers({ shouldAdvanceTime: true });

    renderPage();
    const input = await screen.findByPlaceholderText<HTMLInputElement>(/buscar por código/i);

    fireEvent.change(input, { target: { value: "M-006" } });
    act(() => vi.advanceTimersByTime(300)); // vence el debounce, dispara la segunda consulta
    await vi.waitFor(() => expect(fetchDashboard).toHaveBeenCalledTimes(2));

    // La segunda consulta todavía no resolvió: el input debe seguir montado y conservar lo
    // que el usuario escribió, no reemplazarse por "Cargando...".
    expect(screen.getByPlaceholderText<HTMLInputElement>(/buscar por código/i)).toHaveValue("M-006");

    resolveSegundaConsulta?.({ muestras: [], alertas_desfase: [], errores_validacion: [] });
    vi.useRealTimers();
  });

  it("does not retry the export alert once a later export succeeds", async () => {
    vi.mocked(fetchDashboard).mockResolvedValue({ muestras: [], alertas_desfase: [], errores_validacion: [] });
    vi.mocked(exportDashboard).mockRejectedValueOnce(new ApiError(500, "falla temporal"));
    vi.mocked(exportDashboard).mockResolvedValueOnce(new Blob());

    renderPage();
    await waitFor(() => screen.getByRole("button", { name: /exportar/i }));

    fireEvent.click(screen.getByRole("button", { name: /exportar/i }));
    await screen.findByRole("alert");

    fireEvent.click(screen.getByRole("button", { name: /exportar/i }));
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
  });
});
