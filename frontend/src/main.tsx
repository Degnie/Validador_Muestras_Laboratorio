import * as React from "react";
import { StrictMode } from "react";
import * as ReactDOM from "react-dom";
import { createRoot } from "react-dom/client";

import App from "./App";
import "./main.css";

const root = createRoot(document.getElementById("root")!);

// axe-core/react audita el árbol montado y tira warnings de contraste/ARIA por consola --
// solo en dev: el import dinámico + el chequeo de import.meta.env.DEV hacen que Vite
// elimine esta rama entera (y el chunk de axe-core) del build de producción.
if (import.meta.env.DEV) {
  void import("@axe-core/react").then(({ default: axe }) => {
    axe(React, ReactDOM, 1000);
  });
}

root.render(
  <StrictMode>
    <App />
  </StrictMode>,
);
