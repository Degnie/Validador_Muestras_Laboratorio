import { useEffect, useState } from "react";

type Tema = "light" | "dark";
const STORAGE_KEY = "tema";

function prefiereOscuro(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function temaGuardado(): Tema | null {
  const valor = localStorage.getItem(STORAGE_KEY);
  return valor === "light" || valor === "dark" ? valor : null;
}

// `null` = sin preferencia explícita del usuario: sigue al sistema operativo (media query en
// main.css). Elegir un tema en el toggle sí fija una preferencia explícita, guardada.
export function useTheme() {
  const [temaElegido, setTemaElegido] = useState<Tema | null>(temaGuardado);

  useEffect(() => {
    if (temaElegido) {
      document.documentElement.dataset.theme = temaElegido;
      localStorage.setItem(STORAGE_KEY, temaElegido);
    } else {
      delete document.documentElement.dataset.theme;
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [temaElegido]);

  const esOscuro = temaElegido ? temaElegido === "dark" : prefiereOscuro();

  function alternar() {
    setTemaElegido(esOscuro ? "light" : "dark");
  }

  return { esOscuro, alternar };
}
