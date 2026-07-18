import { List, type RowComponentProps } from "react-window";

import type { DashboardResponse, EstadoMuestra, MuestraEstado } from "../types/muestra";
import "./Dashboard.css";

const ESTADO_CLASS: Record<EstadoMuestra, string> = {
  Completo: "estado-completo",
  Faltante: "estado-faltante",
  "Pruebas Fantasma": "estado-pruebas-fantasma",
};

const ROW_HEIGHT = 44;

function detalle(muestra: MuestraEstado): string {
  const partes = [];
  if (muestra.pruebas_faltantes.length > 0) partes.push(`Faltan: ${muestra.pruebas_faltantes.join(", ")}`);
  if (muestra.pruebas_fantasma.length > 0) partes.push(`Fantasma: ${muestra.pruebas_fantasma.join(", ")}`);
  return partes.join(" ");
}

function Fila({ index, style, muestras }: RowComponentProps<{ muestras: MuestraEstado[] }>) {
  const muestra = muestras[index];
  return (
    <div className="fila" style={style}>
      <span>{muestra.id_muestra}</span>
      <span>
        <span className={`estado ${ESTADO_CLASS[muestra.estado]}`}>{muestra.estado}</span>
      </span>
      <span>{detalle(muestra)}</span>
    </div>
  );
}

interface DashboardProps {
  data: DashboardResponse;
  query: string;
  onQueryChange: (query: string) => void;
  onExport: () => void;
}

export function Dashboard({ data, query, onQueryChange, onExport }: DashboardProps) {
  return (
    <div>
      <div className="barra-superior">
        <input
          type="search"
          placeholder="Buscar por código de muestra..."
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
        />
        <button type="button" onClick={onExport}>
          Exportar a Excel
        </button>
      </div>

      {data.alertas_desfase.length > 0 && (
        <div className="alerta-desfase">
          Archivos desactualizados: {data.alertas_desfase.join(", ")}
        </div>
      )}

      <div className="fila fila-header">
        <span>Muestra</span>
        <span>Estado</span>
        <span>Detalle</span>
      </div>
      <List
        rowComponent={Fila}
        rowCount={data.muestras.length}
        rowHeight={ROW_HEIGHT}
        rowProps={{ muestras: data.muestras }}
        defaultHeight={Math.min(data.muestras.length * ROW_HEIGHT, 480) || ROW_HEIGHT}
      />
    </div>
  );
}
