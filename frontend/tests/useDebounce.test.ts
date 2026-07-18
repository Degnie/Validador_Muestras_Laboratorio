import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useDebounce } from "../src/hooks/useDebounce";

describe("useDebounce", () => {
  it("keeps the initial value until the delay elapses", () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ value }) => useDebounce(value, 300), {
      initialProps: { value: "a" },
    });

    rerender({ value: "ab" });
    expect(result.current).toBe("a");

    act(() => vi.advanceTimersByTime(300));
    expect(result.current).toBe("ab");

    vi.useRealTimers();
  });

  it("resets the timer on rapid successive changes", () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ value }) => useDebounce(value, 300), {
      initialProps: { value: "a" },
    });

    rerender({ value: "ab" });
    act(() => vi.advanceTimersByTime(200));
    rerender({ value: "abc" });
    act(() => vi.advanceTimersByTime(200));
    expect(result.current).toBe("a"); // aún no pasaron 300ms desde el último cambio

    act(() => vi.advanceTimersByTime(100));
    expect(result.current).toBe("abc");

    vi.useRealTimers();
  });
});
