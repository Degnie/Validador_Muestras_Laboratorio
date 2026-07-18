import "@testing-library/jest-dom/vitest";

// jsdom no implementa ResizeObserver; react-window (virtualización de listas) lo requiere.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;
