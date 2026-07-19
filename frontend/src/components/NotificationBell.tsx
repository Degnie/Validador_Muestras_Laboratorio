import { useState } from "react";

import type { Notificacion } from "../hooks/useNotificaciones";

const FECHA_FORMAT = new Intl.DateTimeFormat("es-PE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

interface NotificationBellProps {
  notificaciones: Notificacion[];
  noLeidas: number;
  onAbrir: () => void;
}

export function NotificationBell({ notificaciones, noLeidas, onAbrir }: NotificationBellProps) {
  const [abierto, setAbierto] = useState(false);

  function alternar() {
    const nuevoEstado = !abierto;
    setAbierto(nuevoEstado);
    if (nuevoEstado) onAbrir();
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={alternar}
        aria-haspopup="true"
        aria-expanded={abierto}
        aria-label={`Notificaciones${noLeidas > 0 ? ` (${noLeidas} sin leer)` : ""}`}
        className="relative border border-line-strong bg-transparent p-2 text-ink hover:bg-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5" aria-hidden="true">
          <path d="M10 2a6 6 0 00-6 6v2.586l-1.707 1.707A1 1 0 003 14h14a1 1 0 00.707-1.707L16 10.586V8a6 6 0 00-6-6zM8.5 16a1.5 1.5 0 003 0h-3z" />
        </svg>
        {noLeidas > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[0.625rem] font-bold text-white">
            {noLeidas}
          </span>
        )}
      </button>

      {abierto && (
        <div
          role="region"
          aria-label="Buzón de notificaciones"
          className="absolute right-0 z-10 mt-2 w-80 max-w-[90vw] border border-line bg-surface shadow-lg"
        >
          {notificaciones.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-ink-soft">Sin notificaciones todavía.</p>
          ) : (
            <ul className="max-h-80 divide-y divide-line overflow-y-auto">
              {notificaciones.map((n) => (
                <li key={n.id} className={`px-4 py-2.5 text-sm ${n.leida ? "text-ink-soft" : "font-semibold text-ink"}`}>
                  <span className="font-mono">{n.id_muestra}</span> completó <strong>{n.prueba}</strong>
                  <div className="text-xs font-normal text-ink-soft">{FECHA_FORMAT.format(new Date(n.fecha))}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
