import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError, exportDashboard, fetchDashboard } from "../src/services/api";

describe("fetchDashboard", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the parsed dashboard payload on success", async () => {
    const payload = { muestras: [], alertas_desfase: [], errores_validacion: [] };
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => payload });
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchDashboard();

    expect(result).toEqual(payload);
    expect(fetchMock).toHaveBeenCalledWith("/api/muestras", { signal: undefined });
  });

  it("hits the search endpoint with the query when one is given", async () => {
    const payload = { muestras: [], alertas_desfase: [], errores_validacion: [] };
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => payload });
    vi.stubGlobal("fetch", fetchMock);

    await fetchDashboard("M-006");

    expect(fetchMock).toHaveBeenCalledWith("/api/muestras/buscar?q=M-006", { signal: undefined });
  });

  it("forwards the AbortSignal to fetch so React Query can cancel obsolete requests", async () => {
    const payload = { muestras: [], alertas_desfase: [], errores_validacion: [] };
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => payload });
    vi.stubGlobal("fetch", fetchMock);
    const controller = new AbortController();

    await fetchDashboard(undefined, controller.signal);

    expect(fetchMock).toHaveBeenCalledWith("/api/muestras", { signal: controller.signal });
  });

  it("re-throws AbortError as-is instead of wrapping it in an ApiError", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new DOMException("aborted", "AbortError")));

    await expect(fetchDashboard()).rejects.toMatchObject({ name: "AbortError" });
  });

  it("throws an ApiError carrying the HTTP status when the response is not ok", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 422 }));

    await expect(fetchDashboard()).rejects.toMatchObject({ status: 422 });
  });

  it("throws an ApiError with status 0 when the network fails outright", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    await expect(fetchDashboard()).rejects.toMatchObject({ status: 0 });
  });

  it("rejects a payload that doesn't match the expected contract (backend/frontend drift)", async () => {
    const payloadRoto = { muestras: "esto-deberia-ser-un-array" };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => payloadRoto }));

    await expect(fetchDashboard()).rejects.toThrow(ApiError);
  });
});

describe("exportDashboard", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the exported file as a Blob", async () => {
    const blob = new Blob(["contenido"]);
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, blob: async () => blob });
    vi.stubGlobal("fetch", fetchMock);

    const result = await exportDashboard();

    expect(fetchMock).toHaveBeenCalledWith("/api/muestras/exportar", { signal: undefined });
    expect(result).toBe(blob);
  });

  it("throws an ApiError carrying the HTTP status when the response is not ok", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 413 }));

    await expect(exportDashboard()).rejects.toMatchObject({ status: 413 });
  });
});

describe("ApiError.friendlyMessage", () => {
  it.each([
    [0, /conexión/i],
    [413, /grande/i],
    [422, /inválid/i],
    [500, /servidor/i],
    [418, /error/i], // fallback genérico para códigos no mapeados
  ])("maps status %i to a message matching %s", (status, expected) => {
    expect(new ApiError(status, "detalle crudo").friendlyMessage).toMatch(expected);
  });
});
