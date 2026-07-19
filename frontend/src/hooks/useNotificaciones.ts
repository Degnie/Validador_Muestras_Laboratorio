import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "notificaciones";
const MAX_NOTIFICACIONES = 50;

export interface Notificacion {
  id: string;
  id_muestra: string;
  prueba: string;
  fecha: string;
  leida: boolean;
}

function loadNotificaciones(): Notificacion[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function useNotificaciones() {
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>(loadNotificaciones);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notificaciones));
  }, [notificaciones]);

  const agregarNotificacion = useCallback((id_muestra: string, prueba: string) => {
    const nueva: Notificacion = {
      id: `${id_muestra}:${prueba}:${Date.now()}`,
      id_muestra,
      prueba,
      fecha: new Date().toISOString(),
      leida: false,
    };
    setNotificaciones((current) => [nueva, ...current].slice(0, MAX_NOTIFICACIONES));
  }, []);

  const marcarTodasLeidas = useCallback(() => {
    setNotificaciones((current) => current.map((n) => ({ ...n, leida: true })));
  }, []);

  const noLeidas = notificaciones.filter((n) => !n.leida).length;

  return { notificaciones, noLeidas, agregarNotificacion, marcarTodasLeidas };
}
