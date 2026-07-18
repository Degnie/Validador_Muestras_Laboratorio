import { afterEach, describe, expect, it, vi } from "vitest";

import { exportDashboard, fetchDashboard } from "../src/services/api";

describe("fetchDashboard", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the parsed dashboard payload on success", async () => {
    const payload = { muestras: [], alertas_desfase: [] };
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => payload });
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchDashboard();

    expect(result).toEqual(payload);
    expect(fetchMock).toHaveBeenCalledWith("/api/muestras");
  });

  it("hits the search endpoint with the query when one is given", async () => {
    const payload = { muestras: [], alertas_desfase: [] };
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => payload });
    vi.stubGlobal("fetch", fetchMock);

    await fetchDashboard("M-006");

    expect(fetchMock).toHaveBeenCalledWith("/api/muestras/buscar?q=M-006");
  });

  it("throws when the response is not ok", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));

    await expect(fetchDashboard()).rejects.toThrow();
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

    expect(fetchMock).toHaveBeenCalledWith("/api/muestras/exportar");
    expect(result).toBe(blob);
  });

  it("throws when the response is not ok", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));

    await expect(exportDashboard()).rejects.toThrow();
  });
});
