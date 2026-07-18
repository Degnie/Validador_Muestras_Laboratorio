import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchDashboard } from "../src/services/api";

describe("fetchDashboard", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the parsed dashboard payload on success", async () => {
    const payload = { muestras: [], alertas_desfase: [] };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => payload }),
    );

    const result = await fetchDashboard();

    expect(result).toEqual(payload);
  });

  it("throws when the response is not ok", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 500 }),
    );

    await expect(fetchDashboard()).rejects.toThrow();
  });
});
