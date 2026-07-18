import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Dashboard } from "../src/components/Dashboard";
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

describe("Dashboard", () => {
  it("lists every muestra with its estado", () => {
    render(<Dashboard data={data} />);

    expect(screen.getByText("M-001")).toBeInTheDocument();
    expect(screen.getByText("Completo")).toBeInTheDocument();
    expect(screen.getByText("Faltante")).toBeInTheDocument();
    expect(screen.getByText("Pruebas Fantasma")).toBeInTheDocument();
  });

  it("shows missing/ghost test details", () => {
    render(<Dashboard data={data} />);

    expect(screen.getByText(/Microbiologia/)).toBeInTheDocument();
    expect(screen.getByText(/Plaguicidas/)).toBeInTheDocument();
  });

  it("shows a staleness alert banner when files are out of date", () => {
    render(<Dashboard data={data} />);

    expect(screen.getByText(/Area_3_Validacion_Informes/)).toBeInTheDocument();
  });

  it("shows no staleness banner when everything is fresh", () => {
    render(<Dashboard data={{ ...data, alertas_desfase: [] }} />);

    expect(screen.queryByText(/desactualizad/i)).not.toBeInTheDocument();
  });
});
