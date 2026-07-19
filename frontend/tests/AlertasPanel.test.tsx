import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AlertasPanel } from "../src/components/AlertasPanel";
import { ToastProvider } from "../src/components/Toast";
import type { AlertaActiva } from "../src/hooks/useAlertas";

const alertas: AlertaActiva[] = [
  { id_muestra: "M-011", prueba: "Dureza_Total", creada: "2026-07-19T10:00:00.000Z" },
  { id_muestra: "M-014", prueba: "Turbidez", creada: "2026-07-19T10:05:00.000Z" },
];

function renderPanel(props: Partial<React.ComponentProps<typeof AlertasPanel>> = {}) {
  return render(
    <ToastProvider>
      <AlertasPanel listaAlertas={alertas} onVolver={vi.fn()} onActualizar={vi.fn()} {...props} />
    </ToastProvider>,
  );
}

describe("AlertasPanel", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("lists every pending alert with its sample and test name", () => {
    renderPanel();

    expect(screen.getByText("M-011")).toBeInTheDocument();
    expect(screen.getByText("Dureza_Total")).toBeInTheDocument();
    expect(screen.getByText("M-014")).toBeInTheDocument();
    expect(screen.getByText("Turbidez")).toBeInTheDocument();
  });

  it("shows an empty state when there are no pending alerts", () => {
    renderPanel({ listaAlertas: [] });

    expect(screen.getByText(/no hay alertas pendientes/i)).toBeInTheDocument();
  });

  it("calls onVolver when the back button is clicked", () => {
    const onVolver = vi.fn();
    renderPanel({ onVolver });

    fireEvent.click(screen.getByRole("button", { name: /volver/i }));

    expect(onVolver).toHaveBeenCalled();
  });

  it("calls onActualizar when the refresh button is clicked", () => {
    const onActualizar = vi.fn();
    renderPanel({ onActualizar });

    fireEvent.click(screen.getByRole("button", { name: /actualizar/i }));

    expect(onActualizar).toHaveBeenCalled();
  });

  it("posts the pending alerts and triggers an xlsx download when exporting", async () => {
    const blob = new Blob(["contenido"]);
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, blob: async () => blob });
    vi.stubGlobal("fetch", fetchMock);
    const clickSpy = vi.fn();
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      const el = originalCreateElement(tag);
      if (tag === "a") el.click = clickSpy;
      return el;
    });

    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: /exportar a excel/i }));

    await waitFor(() => expect(clickSpy).toHaveBeenCalled());
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/notificaciones/exportar",
      expect.objectContaining({ method: "POST" }),
    );
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).toEqual({ alertas });
  });

  it("shows a friendly error toast when the export request fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));

    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: /exportar a excel/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/servidor/i);
  });

  it("disables the export button when there are no pending alerts", () => {
    renderPanel({ listaAlertas: [] });

    expect(screen.getByRole("button", { name: /exportar a excel/i })).toBeDisabled();
  });
});
