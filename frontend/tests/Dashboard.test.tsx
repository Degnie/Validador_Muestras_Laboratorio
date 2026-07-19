import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Dashboard } from "../src/components/Dashboard";
import { ApiError } from "../src/services/api";
import type { DashboardResponse } from "../src/types/muestra";

const data: DashboardResponse = {
  muestras: [
    {
      id_muestra: "M-001",
      estado: "Completo",
      tipo_analisis: "Agua Potable",
      pruebas_faltantes: [],
      pruebas_fantasma: [],
      pruebas: [{ nombre_prueba: "pH", resultado: "OK", valor: "7.2", tecnico: "Tec. Pérez", fecha: "2026-07-11" }],
    },
    {
      id_muestra: "M-003",
      estado: "Faltante",
      tipo_analisis: "Agua Residual",
      pruebas_faltantes: ["Microbiologia"],
      pruebas_fantasma: [],
      pruebas: [],
    },
    {
      id_muestra: "M-004",
      estado: "Pruebas Fantasma",
      tipo_analisis: "Agua Residual",
      pruebas_faltantes: [],
      pruebas_fantasma: ["Plaguicidas"],
      pruebas: [
        { nombre_prueba: "Plaguicidas", resultado: "OK", valor: "0.01 mg/L", tecnico: "Tec. Gómez", fecha: "2026-07-12" },
      ],
    },
  ],
  alertas_desfase: ["Checklist_Maestro"],
  errores_validacion: [],
};

function setup(overrides: Partial<React.ComponentProps<typeof Dashboard>> = {}) {
  const onQueryChange = vi.fn();
  const onExport = vi.fn();
  const onCrearAlerta = vi.fn();
  const onAbrirNotificaciones = vi.fn();
  const onActualizar = vi.fn();
  const onVerAlertas = vi.fn();
  const utils = render(
    <Dashboard
      data={data}
      query=""
      onQueryChange={onQueryChange}
      onExport={onExport}
      tieneAlerta={() => false}
      onCrearAlerta={onCrearAlerta}
      notificaciones={[]}
      noLeidas={0}
      onAbrirNotificaciones={onAbrirNotificaciones}
      onActualizar={onActualizar}
      ultimaSyncTimestamp={Date.now()}
      intervaloAutoRefreshMs={60_000}
      autoRefreshPausado={false}
      alertasPendientesCount={0}
      onVerAlertas={onVerAlertas}
      {...overrides}
    />,
  );
  return { onQueryChange, onExport, onCrearAlerta, onAbrirNotificaciones, onActualizar, onVerAlertas, ...utils };
}

// El panel de detalle de cada muestra ahora se monta siempre (colapsado vía
// grid-template-rows + aria-hidden, no desmontado) para poder animar la apertura/cierre --
// así que `getByText` ya no alcanza para "solo lo que está expandido" como antes: hay que
// acotar la búsqueda al panel puntual por su id.
function panelDetalle(id_muestra: string) {
  return document.getElementById(`detalle-${id_muestra}`)!;
}

describe("Dashboard", () => {
  it("lists every muestra with its estado", () => {
    setup();

    expect(screen.getByText("M-001")).toBeInTheDocument();
    expect(screen.getByText("Completo")).toBeInTheDocument();
    // "Faltante" también aparece dentro del panel de detalle de M-003 (siempre montado,
    // colapsado) como el Resultado de la prueba que falta -- getAllByText en vez de getByText.
    expect(screen.getAllByText("Faltante").length).toBeGreaterThan(0);
    expect(screen.getByText("Pruebas Adicionales")).toBeInTheDocument();
    expect(screen.queryByText("Pruebas Fantasma")).not.toBeInTheDocument();
  });

  it("shows missing/additional test details", () => {
    setup();

    // Mismo motivo que arriba: el nombre de la prueba aparece tanto en el resumen de la fila
    // ("Faltan: Microbiologia") como en la tabla de detalle siempre montada.
    expect(screen.getAllByText(/Microbiologia/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Plaguicidas/).length).toBeGreaterThan(0);
  });

  it("updates the 'última sincronización' label on every new sync timestamp, even with unchanged data (regression)", () => {
    // Bug real reportado: el auto-refresh (refetchInterval) sí pegaba al backend, pero el
    // reloj de "última sincronización" no se movía. Causa: React Query hace structural
    // sharing -- si el contenido no cambió, `data` conserva la MISMA referencia, y el
    // `useEffect` anterior (dependía de `[data]`) nunca se volvía a disparar. El fix pasa a
    // depender de `ultimaSyncTimestamp` (prop, ya no estado derivado de `data`), que cambia
    // en cada fetch exitoso sin importar si el contenido es idéntico.
    const t0 = new Date("2026-07-19T13:00:00").getTime();
    const { rerender } = setup({ ultimaSyncTimestamp: t0 });
    expect(screen.getByText(/última sincronización 01:00 p\. m\./i)).toBeInTheDocument();

    const t1 = new Date("2026-07-19T13:04:00").getTime();
    rerender(
      <Dashboard
        data={data}
        query=""
        onQueryChange={() => {}}
        onExport={() => {}}
        tieneAlerta={() => false}
        onCrearAlerta={() => {}}
        notificaciones={[]}
        noLeidas={0}
        onAbrirNotificaciones={() => {}}
        onActualizar={() => {}}
        alertasPendientesCount={0}
        onVerAlertas={() => {}}
        ultimaSyncTimestamp={t1}
        intervaloAutoRefreshMs={60_000}
        autoRefreshPausado={false}
      />,
    );

    expect(screen.getByText(/última sincronización 01:04 p\. m\./i)).toBeInTheDocument();
  });

  it("shows a staleness alert banner when files are out of date", () => {
    setup();

    expect(screen.getByText(/Checklist_Maestro/)).toBeInTheDocument();
  });

  it("shows no staleness banner when everything is fresh", () => {
    setup({ data: { ...data, alertas_desfase: [] } });

    expect(screen.queryByText(/desactualizad/i)).not.toBeInTheDocument();
  });

  it("shows a partial-success banner listing rows discarded by the backend", () => {
    setup({ data: { ...data, errores_validacion: ["Fila 3: prueba_requerida - field required"] } });

    expect(screen.getByRole("alert")).toHaveTextContent(/descartada/i);
    expect(screen.getByRole("alert")).toHaveTextContent(/Fila 3/);
  });

  it("shows no validation-error banner when nothing was discarded", () => {
    setup();

    expect(screen.queryByText(/descartada/i)).not.toBeInTheDocument();
  });

  it("caps the search input at 200 characters, matching the backend truncation limit", () => {
    setup();

    expect(screen.getByPlaceholderText(/buscar por código/i)).toHaveAttribute("maxLength", "200");
  });

  it("calls onQueryChange as the user types in the search box", () => {
    const { onQueryChange } = setup();

    fireEvent.change(screen.getByPlaceholderText(/buscar por código/i), {
      target: { value: "M-006" },
    });

    expect(onQueryChange).toHaveBeenCalledWith("M-006");
  });

  it("calls onExport when the export button is clicked", () => {
    const { onExport } = setup();

    fireEvent.click(screen.getByRole("button", { name: /exportar/i }));

    expect(onExport).toHaveBeenCalled();
  });

  it("shows a friendly alert instead of the table when there's an API error", () => {
    setup({ error: new ApiError(500, "detalle crudo del server") });

    expect(screen.getByRole("alert")).toHaveTextContent(/servidor/i);
    expect(screen.queryByText("M-001")).not.toBeInTheDocument();
  });

  it("still shows the search bar when there's an error, so the user can retry", () => {
    setup({ error: new ApiError(422, "detalle") });

    expect(screen.getByPlaceholderText(/buscar por código/i)).toBeInTheDocument();
  });

  it("shows a loading skeleton instead of the table when isLoading is true", () => {
    setup({ isLoading: true });

    expect(screen.queryByText("M-001")).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: /resultados/i })).toHaveAttribute("aria-busy", "true");
  });

  it("shows the real table once isLoading is false, without a stale aria-busy flag", () => {
    setup({ isLoading: false });

    expect(screen.getByText("M-001")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: /resultados/i })).not.toHaveAttribute("aria-busy");
  });

  it("expands right below the clicked row to show the checklist-vs-data detail, with a Valor column", () => {
    setup();

    fireEvent.click(screen.getByText("M-003"));

    const panel = panelDetalle("M-003");
    expect(panel).not.toHaveAttribute("aria-hidden", "true");
    expect(within(panel).getByText(/Tipo de análisis/)).toBeInTheDocument();
    expect(within(panel).getByText("Agua Residual")).toBeInTheDocument();
    expect(within(panel).getByRole("columnheader", { name: "Valor" })).toBeInTheDocument();
    const fila = within(panel).getByText("Microbiologia").closest("tr");
    expect(fila).toHaveTextContent("Faltante");
  });

  it("collapses the detail view when the same row is clicked again", () => {
    setup();

    fireEvent.click(screen.getByText("M-001"));
    expect(panelDetalle("M-001")).not.toHaveAttribute("aria-hidden", "true");

    fireEvent.click(screen.getByText("M-001"));
    expect(panelDetalle("M-001")).toHaveAttribute("aria-hidden", "true");
  });

  it("links the expand button to its detail panel via aria-controls/aria-expanded", () => {
    setup();

    const boton = screen.getByText("M-003");
    expect(boton).toHaveAttribute("aria-expanded", "false");
    expect(boton).toHaveAttribute("aria-controls", "detalle-M-003");

    fireEvent.click(boton);

    expect(boton).toHaveAttribute("aria-expanded", "true");
  });

  it("'Contraer todo' collapses the open row and starts disabled when nothing is expanded", () => {
    setup();

    const contraer = screen.getByRole("button", { name: /contraer todo/i });
    expect(contraer).toBeDisabled();

    fireEvent.click(screen.getByText("M-003"));
    expect(contraer).not.toBeDisabled();

    fireEvent.click(contraer);

    expect(panelDetalle("M-003")).toHaveAttribute("aria-hidden", "true");
    expect(contraer).toBeDisabled();
  });

  it("shows an alert bell only for missing tests, not for completed or additional ones", () => {
    setup();

    fireEvent.click(screen.getByText("M-003"));
    expect(screen.getByRole("button", { name: /avisarme cuando microbiologia/i })).toBeInTheDocument();

    fireEvent.click(screen.getByText("M-003")); // colapsa
    fireEvent.click(screen.getByText("M-004")); // Pruebas Adicionales, sin faltantes
    expect(screen.queryByRole("button", { name: /avisarme cuando/i })).not.toBeInTheDocument();
  });

  it("calls onCrearAlerta with the sample id and the missing test name when the bell is clicked", () => {
    const { onCrearAlerta } = setup();

    fireEvent.click(screen.getByText("M-003"));
    fireEvent.click(screen.getByRole("button", { name: /avisarme cuando microbiologia/i }));

    expect(onCrearAlerta).toHaveBeenCalledWith("M-003", "Microbiologia");
  });

  it("calls onActualizar when the refresh button is clicked", () => {
    const { onActualizar } = setup();

    fireEvent.click(screen.getByRole("button", { name: /actualizar/i }));

    expect(onActualizar).toHaveBeenCalled();
  });

  it("calls onVerAlertas when the pending-alerts button is clicked, showing the pending count", () => {
    const { onVerAlertas } = setup({ alertasPendientesCount: 3 });

    const boton = screen.getByRole("button", { name: /alertas pendientes/i });
    expect(boton).toHaveTextContent("3");
    fireEvent.click(boton);

    expect(onVerAlertas).toHaveBeenCalled();
  });

  it("does not show a pending count badge when there are no pending alerts", () => {
    setup({ alertasPendientesCount: 0 });

    expect(screen.getByRole("button", { name: /alertas pendientes/i })).not.toHaveTextContent(/\d/);
  });

  it("exposes the results grid with table/row/cell ARIA roles for assistive tech", () => {
    setup();

    expect(screen.getByRole("table", { name: /muestras/i })).toBeInTheDocument();
    const encabezados = screen.getAllByRole("columnheader");
    expect(encabezados.map((c) => c.textContent)).toEqual(["Muestra", "Estado", "Detalle"]);
    const filas = screen.getAllByRole("row");
    // La fila de encabezado + una por muestra (3 en el fixture).
    expect(filas.length).toBe(4);
    expect(screen.getAllByRole("cell").length).toBeGreaterThan(0);
  });

  it("shows a 'Limpiar búsqueda' CTA on the empty state that clears the query and refocuses the results", () => {
    const { onQueryChange } = setup({ data: { ...data, muestras: [] }, query: "M-999" });

    const boton = screen.getByRole("button", { name: /limpiar búsqueda/i });
    fireEvent.click(boton);

    expect(onQueryChange).toHaveBeenCalledWith("");
    expect(screen.getByRole("region", { name: /resultados/i })).toHaveFocus();
  });

  it("does not show the 'Limpiar búsqueda' CTA when the empty state isn't due to a search", () => {
    setup({ data: { ...data, muestras: [] }, query: "" });

    expect(screen.queryByRole("button", { name: /limpiar búsqueda/i })).not.toBeInTheDocument();
  });

  it("notifies the parent when a row expands or collapses, for pausing auto-refresh", () => {
    const onFilaExpandidaChange = vi.fn();
    setup({ onFilaExpandidaChange });

    fireEvent.click(screen.getByText("M-001"));
    expect(onFilaExpandidaChange).toHaveBeenLastCalledWith(true);

    fireEvent.click(screen.getByText("M-001"));
    expect(onFilaExpandidaChange).toHaveBeenLastCalledWith(false);
  });

  it("shows a paused message instead of the countdown when auto-refresh is paused", () => {
    setup({ autoRefreshPausado: true });

    expect(screen.getByText(/auto-refresh en pausa/i)).toBeInTheDocument();
  });

  it("shows a countdown to the next auto-refresh when not paused", () => {
    setup({ autoRefreshPausado: false, ultimaSyncTimestamp: Date.now(), intervaloAutoRefreshMs: 60_000 });

    expect(screen.getByText(/próximo refresco en \d+s/i)).toBeInTheDocument();
  });
});
