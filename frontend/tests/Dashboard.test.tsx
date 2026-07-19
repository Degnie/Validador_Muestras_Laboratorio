import { fireEvent, render, screen } from "@testing-library/react";
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
  render(
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
      alertasPendientesCount={0}
      onVerAlertas={onVerAlertas}
      {...overrides}
    />,
  );
  return { onQueryChange, onExport, onCrearAlerta, onAbrirNotificaciones, onActualizar, onVerAlertas };
}

describe("Dashboard", () => {
  it("lists every muestra with its estado", () => {
    setup();

    expect(screen.getByText("M-001")).toBeInTheDocument();
    expect(screen.getByText("Completo")).toBeInTheDocument();
    expect(screen.getByText("Faltante")).toBeInTheDocument();
    expect(screen.getByText("Pruebas Adicionales")).toBeInTheDocument();
    expect(screen.queryByText("Pruebas Fantasma")).not.toBeInTheDocument();
  });

  it("shows missing/additional test details", () => {
    setup();

    expect(screen.getByText(/Microbiologia/)).toBeInTheDocument();
    expect(screen.getByText(/Plaguicidas/)).toBeInTheDocument();
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

    expect(screen.getByText(/Tipo de análisis/)).toBeInTheDocument();
    expect(screen.getByText("Agua Residual")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Valor" })).toBeInTheDocument();
    const fila = screen.getByText("Microbiologia").closest("tr");
    expect(fila).toHaveTextContent("Faltante");
  });

  it("collapses the detail view when the same row is clicked again", () => {
    setup();

    fireEvent.click(screen.getByText("M-001"));
    expect(screen.getByText(/Tipo de análisis/)).toBeInTheDocument();

    fireEvent.click(screen.getByText("M-001"));
    expect(screen.queryByText(/Tipo de análisis/)).not.toBeInTheDocument();
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
});
