// vite.config.ts
import tailwindcss from "file:///C:/Users/LaAma/Desktop/CLAUDE%20PROYECTOS/Validador%20Centralizado%20de%20Muestras%20de%20Laboratorio/frontend/node_modules/@tailwindcss/vite/dist/index.mjs";
import react from "file:///C:/Users/LaAma/Desktop/CLAUDE%20PROYECTOS/Validador%20Centralizado%20de%20Muestras%20de%20Laboratorio/frontend/node_modules/@vitejs/plugin-react/dist/index.js";
import { visualizer } from "file:///C:/Users/LaAma/Desktop/CLAUDE%20PROYECTOS/Validador%20Centralizado%20de%20Muestras%20de%20Laboratorio/frontend/node_modules/rollup-plugin-visualizer/dist/plugin/index.js";
import { defineConfig } from "file:///C:/Users/LaAma/Desktop/CLAUDE%20PROYECTOS/Validador%20Centralizado%20de%20Muestras%20de%20Laboratorio/frontend/node_modules/vite/dist/node/index.js";
var vite_config_default = defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // Solo genera dist/stats.html en `vite build` (rollup-plugin-visualizer se engancha al
    // hook de rollup, que no corre en el dev server) -- no afecta `vite dev`.
    visualizer({ filename: "dist/stats.html", gzipSize: true, open: false })
  ],
  server: {
    proxy: {
      "/api": "http://localhost:8000"
    }
  },
  build: {
    rollupOptions: {
      output: {
        // Separa el vendor pesado (React + React Query, que cambian con poca frecuencia) del
        // código de la app (que cambia en cada release), así el navegador puede cachear el
        // chunk de vendor entre deploys en vez de re-descargarlo siempre.
        manualChunks: {
          "vendor-react": ["react", "react-dom"],
          "vendor-query": ["@tanstack/react-query"]
        }
      }
    }
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./tests/setup.ts"
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxMYUFtYVxcXFxEZXNrdG9wXFxcXENMQVVERSBQUk9ZRUNUT1NcXFxcVmFsaWRhZG9yIENlbnRyYWxpemFkbyBkZSBNdWVzdHJhcyBkZSBMYWJvcmF0b3Jpb1xcXFxmcm9udGVuZFwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiQzpcXFxcVXNlcnNcXFxcTGFBbWFcXFxcRGVza3RvcFxcXFxDTEFVREUgUFJPWUVDVE9TXFxcXFZhbGlkYWRvciBDZW50cmFsaXphZG8gZGUgTXVlc3RyYXMgZGUgTGFib3JhdG9yaW9cXFxcZnJvbnRlbmRcXFxcdml0ZS5jb25maWcudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL0M6L1VzZXJzL0xhQW1hL0Rlc2t0b3AvQ0xBVURFJTIwUFJPWUVDVE9TL1ZhbGlkYWRvciUyMENlbnRyYWxpemFkbyUyMGRlJTIwTXVlc3RyYXMlMjBkZSUyMExhYm9yYXRvcmlvL2Zyb250ZW5kL3ZpdGUuY29uZmlnLnRzXCI7Ly8vIDxyZWZlcmVuY2UgdHlwZXM9XCJ2aXRlc3QvY29uZmlnXCIgLz5cbmltcG9ydCB0YWlsd2luZGNzcyBmcm9tIFwiQHRhaWx3aW5kY3NzL3ZpdGVcIjtcbmltcG9ydCByZWFjdCBmcm9tIFwiQHZpdGVqcy9wbHVnaW4tcmVhY3RcIjtcbmltcG9ydCB7IHZpc3VhbGl6ZXIgfSBmcm9tIFwicm9sbHVwLXBsdWdpbi12aXN1YWxpemVyXCI7XG5pbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tIFwidml0ZVwiO1xuXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoe1xuICBwbHVnaW5zOiBbXG4gICAgcmVhY3QoKSxcbiAgICB0YWlsd2luZGNzcygpLFxuICAgIC8vIFNvbG8gZ2VuZXJhIGRpc3Qvc3RhdHMuaHRtbCBlbiBgdml0ZSBidWlsZGAgKHJvbGx1cC1wbHVnaW4tdmlzdWFsaXplciBzZSBlbmdhbmNoYSBhbFxuICAgIC8vIGhvb2sgZGUgcm9sbHVwLCBxdWUgbm8gY29ycmUgZW4gZWwgZGV2IHNlcnZlcikgLS0gbm8gYWZlY3RhIGB2aXRlIGRldmAuXG4gICAgdmlzdWFsaXplcih7IGZpbGVuYW1lOiBcImRpc3Qvc3RhdHMuaHRtbFwiLCBnemlwU2l6ZTogdHJ1ZSwgb3BlbjogZmFsc2UgfSksXG4gIF0sXG4gIHNlcnZlcjoge1xuICAgIHByb3h5OiB7XG4gICAgICBcIi9hcGlcIjogXCJodHRwOi8vbG9jYWxob3N0OjgwMDBcIixcbiAgICB9LFxuICB9LFxuICBidWlsZDoge1xuICAgIHJvbGx1cE9wdGlvbnM6IHtcbiAgICAgIG91dHB1dDoge1xuICAgICAgICAvLyBTZXBhcmEgZWwgdmVuZG9yIHBlc2FkbyAoUmVhY3QgKyBSZWFjdCBRdWVyeSwgcXVlIGNhbWJpYW4gY29uIHBvY2EgZnJlY3VlbmNpYSkgZGVsXG4gICAgICAgIC8vIGNcdTAwRjNkaWdvIGRlIGxhIGFwcCAocXVlIGNhbWJpYSBlbiBjYWRhIHJlbGVhc2UpLCBhc1x1MDBFRCBlbCBuYXZlZ2Fkb3IgcHVlZGUgY2FjaGVhciBlbFxuICAgICAgICAvLyBjaHVuayBkZSB2ZW5kb3IgZW50cmUgZGVwbG95cyBlbiB2ZXogZGUgcmUtZGVzY2FyZ2FybG8gc2llbXByZS5cbiAgICAgICAgbWFudWFsQ2h1bmtzOiB7XG4gICAgICAgICAgXCJ2ZW5kb3ItcmVhY3RcIjogW1wicmVhY3RcIiwgXCJyZWFjdC1kb21cIl0sXG4gICAgICAgICAgXCJ2ZW5kb3ItcXVlcnlcIjogW1wiQHRhbnN0YWNrL3JlYWN0LXF1ZXJ5XCJdLFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICB9LFxuICB9LFxuICB0ZXN0OiB7XG4gICAgZW52aXJvbm1lbnQ6IFwianNkb21cIixcbiAgICBnbG9iYWxzOiB0cnVlLFxuICAgIHNldHVwRmlsZXM6IFwiLi90ZXN0cy9zZXR1cC50c1wiLFxuICB9LFxufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQ0EsT0FBTyxpQkFBaUI7QUFDeEIsT0FBTyxXQUFXO0FBQ2xCLFNBQVMsa0JBQWtCO0FBQzNCLFNBQVMsb0JBQW9CO0FBRTdCLElBQU8sc0JBQVEsYUFBYTtBQUFBLEVBQzFCLFNBQVM7QUFBQSxJQUNQLE1BQU07QUFBQSxJQUNOLFlBQVk7QUFBQTtBQUFBO0FBQUEsSUFHWixXQUFXLEVBQUUsVUFBVSxtQkFBbUIsVUFBVSxNQUFNLE1BQU0sTUFBTSxDQUFDO0FBQUEsRUFDekU7QUFBQSxFQUNBLFFBQVE7QUFBQSxJQUNOLE9BQU87QUFBQSxNQUNMLFFBQVE7QUFBQSxJQUNWO0FBQUEsRUFDRjtBQUFBLEVBQ0EsT0FBTztBQUFBLElBQ0wsZUFBZTtBQUFBLE1BQ2IsUUFBUTtBQUFBO0FBQUE7QUFBQTtBQUFBLFFBSU4sY0FBYztBQUFBLFVBQ1osZ0JBQWdCLENBQUMsU0FBUyxXQUFXO0FBQUEsVUFDckMsZ0JBQWdCLENBQUMsdUJBQXVCO0FBQUEsUUFDMUM7QUFBQSxNQUNGO0FBQUEsSUFDRjtBQUFBLEVBQ0Y7QUFBQSxFQUNBLE1BQU07QUFBQSxJQUNKLGFBQWE7QUFBQSxJQUNiLFNBQVM7QUFBQSxJQUNULFlBQVk7QUFBQSxFQUNkO0FBQ0YsQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K
