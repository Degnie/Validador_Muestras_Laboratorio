import type { DashboardResponse, EstadoMuestra } from "../types/muestra";
import "./Dashboard.css";

const ESTADO_CLASS: Record<EstadoMuestra, string> = {
  Completo: "estado-completo",
  Faltante: "estado-faltante",
  "Pruebas Fantasma": "estado-pruebas-fantasma",
};

export function Dashboard({ data }: { data: DashboardResponse }) {
  return (
    <div>
      {data.alertas_desfase.length > 0 && (
        <div className="alerta-desfase">
          Archivos desactualizados: {data.alertas_desfase.join(", ")}
        </div>
      )}
      <table>
        <thead>
          <tr>
            <th>Muestra</th>
            <th>Estado</th>
            <th>Detalle</th>
          </tr>
        </thead>
        <tbody>
          {data.muestras.map((muestra) => (
            <tr key={muestra.id_muestra}>
              <td>{muestra.id_muestra}</td>
              <td>
                <span className={`estado ${ESTADO_CLASS[muestra.estado]}`}>{muestra.estado}</span>
              </td>
              <td>
                {muestra.pruebas_faltantes.length > 0 &&
                  `Faltan: ${muestra.pruebas_faltantes.join(", ")}`}
                {muestra.pruebas_fantasma.length > 0 &&
                  ` Fantasma: ${muestra.pruebas_fantasma.join(", ")}`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
