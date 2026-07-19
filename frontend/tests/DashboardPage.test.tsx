import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ToastProvider } from "../src/components/Toast";
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
    postNotificacion: vi.fn(),
  };
});

import { exportDashboard, fetchDashboard, postNotificacion } from "../src/services/api";

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const utils = render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <DashboardPage />
      </ToastProvider>
    </QueryClientProvider>,
  );
  return { ...utils, client };
}

describe("DashboardPage", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders the dashboard once the data loads", async () => {
    vi.mocked(fetchDashboard).mockResolvedValue({
      muestras: [
        { id_muestra: "M-001", estado: "Completo", tipo_analisis: "Agua Potable", pruebas_faltantes: [], pruebas_fantasma: [], pruebas: [] },
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
        { id_muestra: "M-001", estado: "Completo", tipo_analisis: "Agua Potable", pruebas_faltantes: [], pruebas_fantasma: [], pruebas: [] },
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

  it("auto-refreshes the dashboard every 60s without any user interaction", async () => {
    vi.mocked(fetchDashboard).mockResolvedValue({ muestras: [], alertas_desfase: [], errores_validacion: [] });
    vi.useFakeTimers({ shouldAdvanceTime: true });

    renderPage();
    await vi.waitFor(() => expect(fetchDashboard).toHaveBeenCalledTimes(1));

    // advanceTimersByTimeAsync (no la variante sync) deja que la promesa del fetch resuelva
    // entre cada tick -- React Query recién reprograma el siguiente refetchInterval después
    // de que el anterior se resuelve, así que con la variante sync el reloj interno de la
    // librería nunca llega a reprogramarse dentro del mismo advance.
    await vi.advanceTimersByTimeAsync(59_000);
    expect(fetchDashboard).toHaveBeenCalledTimes(1); // todavía no pasó el minuto

    await vi.advanceTimersByTimeAsync(1_000);
    expect(fetchDashboard).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });

  it("pauses the auto-refresh while a row is expanded, and resumes it once collapsed", async () => {
    vi.mocked(fetchDashboard).mockResolvedValue({
      muestras: [
        {
          id_muestra: "M-001",
          estado: "Completo",
          tipo_analisis: "Agua Potable",
          pruebas_faltantes: [],
          pruebas_fantasma: [],
          pruebas: [],
        },
      ],
      alertas_desfase: [],
      errores_validacion: [],
    });
    vi.useFakeTimers({ shouldAdvanceTime: true });

    renderPage();
    await vi.waitFor(() => expect(screen.getByText("M-001")).toBeInTheDocument());

    fireEvent.click(screen.getByText("M-001"));
    await vi.advanceTimersByTimeAsync(60_000);
    expect(fetchDashboard).toHaveBeenCalledTimes(1); // pausado: no hubo un segundo fetch

    fireEvent.click(screen.getByText("M-001")); // colapsa de nuevo
    await vi.advanceTimersByTimeAsync(60_000);
    expect(fetchDashboard).toHaveBeenCalledTimes(2); // se reanudó

    vi.useRealTimers();
  });

  it("announces successful background refreshes via an aria-live region, but not the initial load", async () => {
    vi.mocked(fetchDashboard).mockResolvedValue({ muestras: [], alertas_desfase: [], errores_validacion: [] });
    vi.useFakeTimers({ shouldAdvanceTime: true });

    renderPage();
    await vi.waitFor(() => expect(fetchDashboard).toHaveBeenCalledTimes(1));
    expect(document.querySelector('[aria-live="polite"]')).toHaveTextContent("");

    await vi.advanceTimersByTimeAsync(60_000);
    await vi.waitFor(() => expect(fetchDashboard).toHaveBeenCalledTimes(2));
    expect(document.querySelector('[aria-live="polite"]')).toHaveTextContent(/datos actualizados/i);

    vi.useRealTimers();
  });

  it("keeps the search input mounted and focusable while a debounced query is still in flight (regression)", async () => {
    // Bug real reportado: con un mock que resuelve en el mismo tick, esta regresión no se ve
    // (el estado de carga dura menos que un microtask). Acá se deja la segunda consulta
    // colgada a propósito para poder observar el estado intermedio, como pasa con latencia de
    // red real.
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
    // que el usuario escribió, no reemplazarse por el skeleton de carga.
    expect(screen.getByPlaceholderText<HTMLInputElement>(/buscar por código/i)).toHaveValue("M-006");

    resolveSegundaConsulta?.({ muestras: [], alertas_desfase: [], errores_validacion: [] });
    vi.useRealTimers();
  });

  it("shows a success toast (not an alert) after a successful export", async () => {
    vi.mocked(fetchDashboard).mockResolvedValue({ muestras: [], alertas_desfase: [], errores_validacion: [] });
    vi.mocked(exportDashboard).mockResolvedValue(new Blob());

    renderPage();
    await waitFor(() => screen.getByRole("button", { name: /exportar/i }));
    fireEvent.click(screen.getByRole("button", { name: /exportar/i }));

    expect(await screen.findByRole("status")).toHaveTextContent(/completada/i);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
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

  it("notifies the mailbox and reports to the backend when an alerted sample's missing test gets completed", async () => {
    localStorage.setItem(
      "alertas_activas",
      JSON.stringify([{ id_muestra: "M-002", prueba: "Microbiologia", creada: "2026-07-19T10:00:00.000Z" }]),
    );
    const muestraConFaltante = {
      id_muestra: "M-002",
      estado: "Faltante" as const,
      tipo_analisis: "Agua Potable",
      pruebas_faltantes: ["Microbiologia"],
      pruebas_fantasma: [],
      pruebas: [],
    };
    vi.mocked(fetchDashboard)
      .mockResolvedValueOnce({ muestras: [muestraConFaltante], alertas_desfase: [], errores_validacion: [] })
      .mockResolvedValueOnce({
        muestras: [{ ...muestraConFaltante, estado: "Completo", pruebas_faltantes: [] }],
        alertas_desfase: [],
        errores_validacion: [],
      });

    const { client } = renderPage();
    await screen.findByText("M-002");

    await act(async () => {
      await client.invalidateQueries();
    });

    await waitFor(() => expect(postNotificacion).toHaveBeenCalledWith("M-002", "Microbiologia"));

    fireEvent.click(screen.getByRole("button", { name: /notificaciones/i }));
    // El panel de "Alertas pendientes" queda siempre montado (oculto vía `hidden`) para
    // conservar su estado al alternar de vista, y su estado vacío también dice "completó" --
    // hay que acotar la búsqueda al buzón de notificaciones puntual.
    const buzon = screen.getByRole("region", { name: /buzón de notificaciones/i });
    expect(within(buzon).getByText(/completó/)).toHaveTextContent("Microbiologia");
  });

  it("shows 'La alerta ya fue generada' instead of creating a duplicate alert on a second bell click", async () => {
    vi.mocked(fetchDashboard).mockResolvedValue({
      muestras: [
        {
          id_muestra: "M-002",
          estado: "Faltante",
          tipo_analisis: "Agua Potable",
          pruebas_faltantes: ["Microbiologia"],
          pruebas_fantasma: [],
          pruebas: [],
        },
      ],
      alertas_desfase: [],
      errores_validacion: [],
    });

    renderPage();
    fireEvent.click(await screen.findByText("M-002"));
    const campana = screen.getByRole("button", { name: /avisarme cuando microbiologia/i });

    fireEvent.click(campana);
    expect(screen.queryByText(/la alerta ya fue generada/i)).not.toBeInTheDocument();

    fireEvent.click(campana);
    expect(await screen.findByText(/la alerta ya fue generada/i)).toBeInTheDocument();
  });

  it("navigates to the pending-alerts panel and back, and refetches when 'Actualizar' is clicked", async () => {
    localStorage.setItem(
      "alertas_activas",
      JSON.stringify([{ id_muestra: "M-011", prueba: "Dureza_Total", creada: "2026-07-19T10:00:00.000Z" }]),
    );
    vi.mocked(fetchDashboard).mockResolvedValue({ muestras: [], alertas_desfase: [], errores_validacion: [] });

    renderPage();
    await screen.findByPlaceholderText(/buscar por código/i);

    fireEvent.click(screen.getByRole("button", { name: /alertas pendientes/i }));
    expect(screen.getByText("M-011")).toBeInTheDocument();
    expect(screen.getByText("Dureza_Total")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /actualizar/i }));
    await waitFor(() => expect(fetchDashboard).toHaveBeenCalledTimes(2));

    fireEvent.click(screen.getByRole("button", { name: /volver al panel principal/i }));
    expect(await screen.findByPlaceholderText(/buscar por código/i)).toBeInTheDocument();
  });
});
