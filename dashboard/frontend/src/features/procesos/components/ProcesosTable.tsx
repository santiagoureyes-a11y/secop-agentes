import type { Proceso } from "../../../types/proceso";
import { COLOR_ESTADO, ETIQUETAS_ESTADO } from "../../../types/proceso";

function formatearMoneda(valor: number | null) {
  if (valor === null) return "—";
  return valor.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
}

const MS_DIA = 1000 * 60 * 60 * 24;

// Cuando la hora de cierre NO está confirmada, la fecha guardada es solo el día (00:00 UTC
// desde Datos Abiertos): se compara el día calendario del cierre contra el día calendario
// actual en Bogotá — comparar instantes daría un día menos (00:00 UTC = 7 p. m. en Bogotá).
function diasCalendarioRestantes(fecha: string): number {
  const cierre = fecha.slice(0, 10);
  const hoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
  return Math.round((Date.parse(cierre) - Date.parse(hoy)) / MS_DIA);
}

// Días (o fracción) hasta el cierre. Con hora confirmada es tiempo real restante;
// sin confirmar, días de calendario. Negativo = ya cerró.
function diasRestantes(fecha: string | null, horaConfirmada: boolean): number | null {
  if (!fecha) return null;
  if (horaConfirmada) return (new Date(fecha).getTime() - Date.now()) / MS_DIA;
  return diasCalendarioRestantes(fecha);
}

function formatearCierre(fecha: string, horaConfirmada: boolean): string {
  if (!horaConfirmada) {
    // Solo se conoce el día — formatear la parte de fecha tal cual, sin convertir zona.
    const [anio, mes, dia] = fecha.slice(0, 10).split("-").map(Number);
    return new Date(Date.UTC(anio, mes - 1, dia, 12)).toLocaleDateString("es-CO", {
      timeZone: "UTC",
      day: "numeric",
      month: "short",
    });
  }
  return new Date(fecha).toLocaleString("es-CO", {
    timeZone: "America/Bogota",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function calcularGanancia(proceso: Proceso): number | null {
  if (!proceso.valorSugerido || !proceso.margenEsperado) return null;
  const costo = proceso.margenEsperado > 0
    ? proceso.valorSugerido / (1 + proceso.margenEsperado)
    : proceso.valorSugerido;
  return proceso.valorSugerido - costo;
}

function DiasCell({ fecha, horaConfirmada }: { fecha: string | null; horaConfirmada: boolean }) {
  const dias = diasRestantes(fecha, horaConfirmada);
  if (fecha === null || dias === null) return <span className="text-slate-300">—</span>;

  // Etiqueta de tiempo restante: horas exactas si la hora es conocida y falta poco.
  let restante: string;
  if (horaConfirmada && dias < 2) {
    restante = dias * 24 < 1 ? `${Math.max(0, Math.floor(dias * 24 * 60))} min` : `${Math.floor(dias * 24)} h`;
  } else {
    restante = horaConfirmada ? `${Math.floor(dias)}d` : dias === 0 ? "hoy" : `${dias}d`;
  }

  const detalle = (
    <p className="mt-1 text-[11px] leading-tight text-slate-400 whitespace-nowrap">
      {formatearCierre(fecha, horaConfirmada)}
      {!horaConfirmada && <span className="block italic text-slate-300">hora por confirmar</span>}
    </p>
  );

  if (dias < 0)
    return (
      <div>
        <span className="text-slate-400 text-xs italic">Cerrado</span>
        {detalle}
      </div>
    );

  const badge =
    dias <= 1
      ? "bg-red-100 text-red-700"
      : dias <= 3
      ? "bg-amber-100 text-amber-700"
      : "";

  return (
    <div>
      {badge ? (
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${badge}`}>
          {restante} {dias <= 1 && "⚠"}
        </span>
      ) : (
        <span className="text-xs text-slate-500">{restante}</span>
      )}
      {detalle}
    </div>
  );
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
            <th className="px-6 py-3 text-right">Ganancia</th>
            <th className="px-6 py-3 text-center">Cierre</th>
            <th className="px-6 py-3"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {procesos.map((proceso) => {
            const dias = diasRestantes(proceso.fechaCierre, proceso.horaCierreConfirmada);
            const esUrgente = dias !== null && dias >= 0 && dias <= 3;
            const ganancia = calcularGanancia(proceso);

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
                    <span className="font-semibold text-slate-800">
                      {formatearMoneda(proceso.valorSugerido)}
                    </span>
                  ) : (
                    <span className="text-slate-300">—</span>
                  )}
                </td>
                <td className="px-6 py-4 text-right tabular-nums">
                  {ganancia !== null ? (
                    <span
                      className={`font-bold ${
                        ganancia <= 500_000 ? "text-red-600" : "text-emerald-700"
                      }`}
                    >
                      {formatearMoneda(Math.round(ganancia))}
                    </span>
                  ) : (
                    <span className="text-slate-300">—</span>
                  )}
                </td>
                <td className="px-6 py-4 text-center">
                  <DiasCell fecha={proceso.fechaCierre} horaConfirmada={proceso.horaCierreConfirmada} />
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
              <td colSpan={8} className="py-16 text-center text-slate-400">
                <div className="text-3xl mb-2">🔍</div>
                <p className="text-sm font-medium">No hay procesos activos</p>
                <p className="text-xs mt-1">El Agente Scout los irá agregando aquí</p>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
