import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ThemeToggle } from "../src/components/ThemeToggle";

describe("ThemeToggle", () => {
  afterEach(() => {
    delete document.documentElement.dataset.theme;
    vi.unstubAllGlobals();
  });

  it("switches to dark mode and persists it on click, when the system prefers light", () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
    );
    render(<ThemeToggle />);

    fireEvent.click(screen.getByRole("button"));

    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(localStorage.getItem("tema")).toBe("dark");
    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "true");
  });

  it("toggles back to light on a second click", () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
    );
    render(<ThemeToggle />);
    const boton = screen.getByRole("button");

    fireEvent.click(boton);
    fireEvent.click(boton);

    expect(document.documentElement.dataset.theme).toBe("light");
    expect(boton).toHaveAttribute("aria-pressed", "false");
  });
});
