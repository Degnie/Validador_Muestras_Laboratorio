import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AlertasPanel } from "../src/components/AlertasPanel";
import type { AlertaActiva } from "../src/hooks/useAlertas";

const alertas: AlertaActiva[] = [
  { id_muestra: "M-011", prueba: "Dureza_Total", creada: "2026-07-19T10:00:00.000Z" },
  { id_muestra: "M-014", prueba: "Turbidez", creada: "2026-07-19T10:05:00.000Z" },
];

describe("AlertasPanel", () => {
  it("lists every pending alert with its sample and test name", () => {
    render(<AlertasPanel listaAlertas={alertas} onVolver={vi.fn()} onActualizar={vi.fn()} />);

    expect(screen.getByText("M-011")).toBeInTheDocument();
    expect(screen.getByText("Dureza_Total")).toBeInTheDocument();
    expect(screen.getByText("M-014")).toBeInTheDocument();
    expect(screen.getByText("Turbidez")).toBeInTheDocument();
  });

  it("shows an empty state when there are no pending alerts", () => {
    render(<AlertasPanel listaAlertas={[]} onVolver={vi.fn()} onActualizar={vi.fn()} />);

    expect(screen.getByText(/no hay alertas pendientes/i)).toBeInTheDocument();
  });

  it("calls onVolver when the back button is clicked", () => {
    const onVolver = vi.fn();
    render(<AlertasPanel listaAlertas={alertas} onVolver={onVolver} onActualizar={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /volver/i }));

    expect(onVolver).toHaveBeenCalled();
  });

  it("calls onActualizar when the refresh button is clicked", () => {
    const onActualizar = vi.fn();
    render(<AlertasPanel listaAlertas={alertas} onVolver={vi.fn()} onActualizar={onActualizar} />);

    fireEvent.click(screen.getByRole("button", { name: /actualizar/i }));

    expect(onActualizar).toHaveBeenCalled();
  });

  it("triggers a CSV download of the pending alerts when exporting", () => {
    const clickSpy = vi.fn();
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      const el = originalCreateElement(tag);
      if (tag === "a") el.click = clickSpy;
      return el;
    });

    render(<AlertasPanel listaAlertas={alertas} onVolver={vi.fn()} onActualizar={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /exportar a excel/i }));

    expect(clickSpy).toHaveBeenCalled();
  });

  it("disables the export button when there are no pending alerts", () => {
    render(<AlertasPanel listaAlertas={[]} onVolver={vi.fn()} onActualizar={vi.fn()} />);

    expect(screen.getByRole("button", { name: /exportar a excel/i })).toBeDisabled();
  });
});
