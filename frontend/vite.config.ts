/// <reference types="vitest/config" />
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { visualizer } from "rollup-plugin-visualizer";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // Solo genera dist/stats.html en `vite build` (rollup-plugin-visualizer se engancha al
    // hook de rollup, que no corre en el dev server) -- no afecta `vite dev`.
    visualizer({ filename: "dist/stats.html", gzipSize: true, open: false }),
  ],
  server: {
    proxy: {
      "/api": "http://localhost:8000",
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Separa el vendor pesado (React + React Query, que cambian con poca frecuencia) del
        // código de la app (que cambia en cada release), así el navegador puede cachear el
        // chunk de vendor entre deploys en vez de re-descargarlo siempre.
        manualChunks: {
          "vendor-react": ["react", "react-dom"],
          "vendor-query": ["@tanstack/react-query"],
        },
      },
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./tests/setup.ts",
  },
});
