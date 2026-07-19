import { useTheme } from "../hooks/useTheme";

function IconoSol() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
      <path d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95a1 1 0 011.414 0l.708.707a1 1 0 01-1.415 1.415l-.707-.708a1 1 0 010-1.414zm-8.486 0a1 1 0 010 1.414l-.707.708a1 1 0 01-1.415-1.415l.708-.707a1 1 0 011.414 0zM17 9a1 1 0 110 2h-1a1 1 0 110-2h1zM4 9a1 1 0 110 2H3a1 1 0 110-2h1zm11.243-5.657a1 1 0 010 1.414l-.707.708a1 1 0 01-1.415-1.415l.708-.707a1 1 0 011.414 0zm-9.9 0a1 1 0 011.414 0l.708.707A1 1 0 015.95 5.465l-.707-.708a1 1 0 010-1.414zM10 16a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1z" />
    </svg>
  );
}

function IconoLuna() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
      <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
    </svg>
  );
}

export function ThemeToggle() {
  const { esOscuro, alternar } = useTheme();
  return (
    <button
      type="button"
      onClick={alternar}
      aria-pressed={esOscuro}
      aria-label={esOscuro ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      title={esOscuro ? "Modo claro" : "Modo oscuro"}
      className="inline-flex h-8 w-8 items-center justify-center border border-line-strong bg-transparent text-ink hover:bg-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      {esOscuro ? <IconoSol /> : <IconoLuna />}
    </button>
  );
}
