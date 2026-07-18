import { describe, expect, it } from "vitest";

import { ApiError } from "../src/services/api";
import { shouldRetry } from "../src/services/queryClient";

describe("shouldRetry", () => {
  it("does not retry a 422 (invalid data won't fix itself)", () => {
    expect(shouldRetry(0, new ApiError(422, "x"))).toBe(false);
  });

  it("does not retry a 413 (payload too large won't fix itself)", () => {
    expect(shouldRetry(0, new ApiError(413, "x"))).toBe(false);
  });

  it("retries once on a network failure (status 0)", () => {
    expect(shouldRetry(0, new ApiError(0, "x"))).toBe(true);
    expect(shouldRetry(1, new ApiError(0, "x"))).toBe(false);
  });

  it("retries once on a 500", () => {
    expect(shouldRetry(0, new ApiError(500, "x"))).toBe(true);
    expect(shouldRetry(1, new ApiError(500, "x"))).toBe(false);
  });

  it("retries once on a non-ApiError (unexpected exception)", () => {
    expect(shouldRetry(0, new Error("boom"))).toBe(true);
  });
});
