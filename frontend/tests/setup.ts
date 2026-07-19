import { afterEach } from "vitest";

import "@testing-library/jest-dom/vitest";

// useAlertas/useNotificaciones persisten en localStorage; sin limpiarlo, un test que crea una
// alerta filtraría estado hacia el siguiente test del mismo archivo.
afterEach(() => {
  localStorage.clear();
});

// jsdom tampoco implementa URL.createObjectURL/revokeObjectURL; triggerDownload() (download.ts)
// los llama al exportar. Sin este stub, cualquier test que dispare una descarga exitosa
// explota con "URL.createObjectURL is not a function" -- silenciosamente, porque queda
// atrapado por el catch de manejo de errores de la app y se confunde con un fallo real de red.
globalThis.URL.createObjectURL ??= () => "blob:mock-url";
globalThis.URL.revokeObjectURL ??= () => {};
