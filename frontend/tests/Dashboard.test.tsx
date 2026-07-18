import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Dashboard } from "../src/components/Dashboard";
import { ApiError } from "../src/services/api";
import type { DashboardResponse } from "../src/types/muestra";

const data: DashboardResponse = {
  muestras: [
    { id_muestra: "M-001", estado: "Completo", pruebas_faltantes: [], pruebas_fantasma: [] },
    {
      id_muestra: "M-003",
      estado: "Faltante",
      pruebas_faltantes: ["Microbiologia"],
      pruebas_fantasma: [],
    },
    {
      id_muestra: "M-004",
      estado: "Pruebas Fantasma",
      pruebas_faltantes: [],
      pruebas_fantasma: ["Plaguicidas"],
    },
  ],
  alertas_desfase: ["Area_3_Validacion_Informes"],
};

function setup(overrides: Partial<React.ComponentProps<typeof Dashboard>> = {}) {
  const onQueryChange = vi.fn();
  const onExport = vi.fn();
  render(
    <Dashboard data={data} query="" onQueryChange={onQueryChange} onExport={onExport} {...overrides} />,
  );
  return { onQueryChange, onExport };
}

describe("Dashboard", () => {
  it("lists every muestra with its estado", () => {
    setup();

    expect(screen.getByText("M-001")).toBeInTheDocument();
    expect(screen.getByText("Completo")).toBeInTheDocument();
    expect(screen.getByText("Faltante")).toBeInTheDocument();
    expect(screen.getByText("Pruebas Fantasma")).toBeInTheDocument();
  });

  it("shows missing/ghost test details", () => {
    setup();

    expect(screen.getByText(/Microbiologia/)).toBeInTheDocument();
    expect(screen.getByText(/Plaguicidas/)).toBeInTheDocument();
  });

  it("shows a staleness alert banner when files are out of date", () => {
    setup();

    expect(screen.getByText(/Area_3_Validacion_Informes/)).toBeInTheDocument();
  });

  it("shows no staleness banner when everything is fresh", () => {
    setup({ data: { ...data, alertas_desfase: [] } });

    expect(screen.queryByText(/desactualizad/i)).not.toBeInTheDocument();
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
});
