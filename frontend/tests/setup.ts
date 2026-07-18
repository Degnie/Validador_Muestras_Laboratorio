import "@testing-library/jest-dom/vitest";

// jsdom no implementa ResizeObserver; react-window (virtualización de listas) lo requiere.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;

// jsdom tampoco implementa URL.createObjectURL/revokeObjectURL; triggerDownload() (download.ts)
// los llama al exportar. Sin este stub, cualquier test que dispare una descarga exitosa
// explota con "URL.createObjectURL is not a function" -- silenciosamente, porque queda
// atrapado por el catch de manejo de errores de la app y se confunde con un fallo real de red.
globalThis.URL.createObjectURL ??= () => "blob:mock-url";
globalThis.URL.revokeObjectURL ??= () => {};
