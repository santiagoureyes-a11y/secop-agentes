import type { Proceso } from "../../../types/proceso";
import { COLOR_ESTADO, ETIQUETAS_ESTADO } from "../../../types/proceso";

function formatearMoneda(valor: number | null) {
  if (valor === null) return "—";
  return valor.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
}

function diasRestantes(fecha: string | null): number | null {
  if (!fecha) return null;
  return Math.ceil((new Date(fecha).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function DiasCell({ fecha }: { fecha: string | null }) {
  const dias = diasRestantes(fecha);
  if (dias === null) return <span className="text-slate-300">—</span>;
  if (dias < 0) return <span className="text-slate-400 text-xs italic">Cerrado</span>;
  if (dias <= 1)
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
        {dias}d ⚠
      </span>
    );
  if (dias <= 3)
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
        {dias}d
      </span>
    );
  return <span className="text-xs text-slate-500">{dias}d</span>;
}

interface ProcesosTableProps {
  procesos: Proceso[];
  onSeleccionar: (id: string) => void;
}

export function ProcesosTable({ procesos, onSeleccionar }: ProcesosTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-slate-100 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-400">
            <th className="px-6 py-3">Estado</th>
            <th className="px-6 py-3">Entidad contratante</th>
            <th className="px-6 py-3">Objeto</th>
            <th className="px-6 py-3 text-right">Presupuesto</th>
            <th className="px-6 py-3 text-right">Propuesta</th>
            <th className="px-6 py-3 text-center">Cierre</th>
            <th className="px-6 py-3"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {procesos.map((proceso) => {
            const dias = diasRestantes(proceso.fechaCierre);
            const esUrgente = dias !== null && dias >= 0 && dias <= 3;

            return (
              <tr
                key={proceso.id}
                onClick={() => onSeleccionar(proceso.id)}
                className={`cursor-pointer transition-colors hover:bg-slate-50 ${
                  esUrgente ? "bg-amber-50/50" : ""
                }`}
              >
                <td className="px-6 py-4">
                  <span
                    className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${
                      COLOR_ESTADO[proceso.estado]
                    }`}
                  >
                    {ETIQUETAS_ESTADO[proceso.estado]}
                  </span>
                </td>
                <td className="px-6 py-4 max-w-[200px]">
                  <p className="truncate font-medium text-slate-800">{proceso.entidad}</p>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">{proceso.idProceso}</p>
                </td>
                <td className="px-6 py-4 max-w-xs">
                  <p className="truncate text-slate-500">{proceso.objeto}</p>
                </td>
                <td className="px-6 py-4 text-right tabular-nums text-slate-700">
                  {formatearMoneda(proceso.valorBase)}
                </td>
                <td className="px-6 py-4 text-right tabular-nums">
                  {proceso.valorSugerido ? (
                    <span className="font-semibold text-emerald-700">
                      {formatearMoneda(proceso.valorSugerido)}
                    </span>
                  ) : (
                    <span className="text-slate-300">—</span>
                  )}
                </td>
                <td className="px-6 py-4 text-center">
                  <DiasCell fecha={proceso.fechaCierre} />
                </td>
                <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                  {proceso.urlProceso ? (
                    <a
                      href={proceso.urlProceso}
                      target="_blank"
                      rel="noreferrer"
                      className="whitespace-nowrap text-xs font-medium text-indigo-500 hover:text-indigo-700"
                    >
                      SECOP →
                    </a>
                  ) : null}
                </td>
              </tr>
            );
          })}
          {procesos.length === 0 && (
            <tr>
              <td colSpan={7} className="py-16 text-center text-slate-400">
                <div className="text-3xl mb-2">🔍</div>
                <p className="text-sm font-medium">No hay procesos todavía</p>
                <p className="text-xs mt-1">El Agente Scout los irá agregando aquí</p>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
