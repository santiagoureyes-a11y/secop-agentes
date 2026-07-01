import type { Proceso } from "../../../types/proceso";
import { COLOR_ESTADO, ETIQUETAS_ESTADO } from "../../../types/proceso";

function formatearMoneda(valor: number | null) {
  if (valor === null) return "—";
  return valor.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
}

function formatearFecha(fecha: string | null) {
  if (!fecha) return "—";
  return new Date(fecha).toLocaleDateString("es-CO");
}

interface ProcesosTableProps {
  procesos: Proceso[];
  onSeleccionar: (id: string) => void;
}

export function ProcesosTable({ procesos, onSeleccionar }: ProcesosTableProps) {
  return (
    <table className="w-full text-left text-sm">
      <thead>
        <tr className="border-b border-zinc-200 text-zinc-500">
          <th className="py-2 pr-4">Estado</th>
          <th className="py-2 pr-4">Empresa</th>
          <th className="py-2 pr-4">Entidad</th>
          <th className="py-2 pr-4">Objeto</th>
          <th className="py-2 pr-4">Valor base</th>
          <th className="py-2 pr-4">Cierre</th>
          <th className="py-2">SECOP</th>
        </tr>
      </thead>
      <tbody>
        {procesos.map((proceso) => (
          <tr
            key={proceso.id}
            onClick={() => onSeleccionar(proceso.id)}
            className="cursor-pointer border-b border-zinc-100 hover:bg-zinc-50"
          >
            <td className="py-3 pr-4">
              <span className={`rounded-full px-2 py-1 text-xs font-medium ${COLOR_ESTADO[proceso.estado]}`}>
                {ETIQUETAS_ESTADO[proceso.estado]}
              </span>
            </td>
            <td className="py-3 pr-4 text-zinc-500">{proceso.empresa?.nombre ?? "—"}</td>
            <td className="py-3 pr-4">{proceso.entidad}</td>
            <td className="max-w-md truncate py-3 pr-4">{proceso.objeto}</td>
            <td className="py-3 pr-4">{formatearMoneda(proceso.valorBase)}</td>
            <td className="py-3 pr-4">{formatearFecha(proceso.fechaCierre)}</td>
            <td className="py-3" onClick={(e) => e.stopPropagation()}>
              {proceso.urlProceso ? (
                <a
                  href={proceso.urlProceso}
                  target="_blank"
                  rel="noreferrer"
                  className="text-indigo-600 hover:underline text-xs whitespace-nowrap"
                >
                  Ver →
                </a>
              ) : (
                <span className="text-zinc-300 text-xs">—</span>
              )}
            </td>
          </tr>
        ))}
        {procesos.length === 0 && (
          <tr>
            <td colSpan={7} className="py-8 text-center text-zinc-400">
              No hay procesos todavía. El Agente Scout los irá agregando aquí.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}
