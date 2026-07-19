import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "alertas_activas";

export interface AlertaActiva {
  id_muestra: string;
  prueba: string;
  creada: string;
}

// Clave compuesta id_muestra+prueba: la alerta es por prueba faltante puntual, no por
// muestra completa (una muestra puede tener varias pruebas faltantes, cada una con su
// propia alerta independiente).
function clave(id_muestra: string, prueba: string): string {
  return `${id_muestra}::${prueba}`;
}

function esAlertaValida(v: unknown): v is AlertaActiva {
  if (typeof v !== "object" || v === null) return false;
  const a = v as Record<string, unknown>;
  return typeof a.id_muestra === "string" && typeof a.prueba === "string" && typeof a.creada === "string";
}

function loadAlertas(): Map<string, AlertaActiva> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    const validas = Array.isArray(parsed) ? parsed.filter(esAlertaValida) : [];
    return new Map(validas.map((a) => [clave(a.id_muestra, a.prueba), a]));
  } catch {
    return new Map();
  }
}

export function useAlertas() {
  const [alertas, setAlertas] = useState<Map<string, AlertaActiva>>(loadAlertas);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...alertas.values()]));
  }, [alertas]);

  const tieneAlerta = useCallback((id_muestra: string, prueba: string) => alertas.has(clave(id_muestra, prueba)), [alertas]);

  // Devuelve false si ya existía (el caller decide cómo avisarle al usuario), evitando que
  // varios clicks sobre la misma campanita generen alertas duplicadas. Lee `alertas` por
  // closure (no por functional update) a propósito: la decisión "¿ya existe?" tiene que ser
  // pura y síncrona, sin depender de que React invoque el updater una sola vez.
  const crearAlerta = useCallback(
    (id_muestra: string, prueba: string): boolean => {
      const k = clave(id_muestra, prueba);
      if (alertas.has(k)) return false;
      setAlertas((current) => {
        const copia = new Map(current);
        copia.set(k, { id_muestra, prueba, creada: new Date().toISOString() });
        return copia;
      });
      return true;
    },
    [alertas],
  );

  const resolverAlerta = useCallback((id_muestra: string, prueba: string) => {
    setAlertas((current) => {
      const k = clave(id_muestra, prueba);
      if (!current.has(k)) return current;
      const copia = new Map(current);
      copia.delete(k);
      return copia;
    });
  }, []);

  // Más antigua primero: es la que lleva más tiempo pendiente, la prioridad operativa del técnico.
  const listaAlertas = [...alertas.values()].sort((a, b) => a.creada.localeCompare(b.creada));

  return { listaAlertas, tieneAlerta, crearAlerta, resolverAlerta };
}
