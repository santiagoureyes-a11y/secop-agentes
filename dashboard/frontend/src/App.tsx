import { useState } from "react";
import { useProcesos, useEjecutarScout } from "./features/procesos/hooks/useProcesos";
import { ProcesosTable } from "./features/procesos/components/ProcesosTable";
import { ProcesoDetail } from "./features/procesos/components/ProcesoDetail";

function formatM(valor: number) {
  if (valor >= 1_000_000) return `$${(valor / 1_000_000).toFixed(1)}M`;
  if (valor >= 1_000) return `$${(valor / 1_000).toFixed(0)}K`;
  return `$${valor}`;
}

// Días de calendario (en Bogotá) hasta el cierre — la fecha de Datos Abiertos trae la hora
// truncada a 00:00 UTC, así que se compara solo el día para no correrse un día hacia atrás.
function diasParaCierre(fecha: string | null): number | null {
  if (!fecha) return null;
  const hoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
  return Math.round((Date.parse(fecha.slice(0, 10)) - Date.parse(hoy)) / (1000 * 60 * 60 * 24));
}

function App() {
  const { data: procesos = [], isLoading, error } = useProcesos();
  const [seleccionado, setSeleccionado] = useState<string | null>(null);
  const scout = useEjecutarScout();

  const activos = procesos.filter((p) => p.estado !== "descartado" && p.estado !== "rechazado");
  const valorTotal = activos.reduce((acc, p) => acc + (p.valorBase ?? 0), 0);
  const gananciaTotal = activos.reduce((acc, p) => {
    if (!p.valorSugerido || !p.margenEsperado) return acc;
    const costo = p.margenEsperado > 0 ? p.valorSugerido / (1 + p.margenEsperado) : p.valorSugerido;
    return acc + (p.valorSugerido - costo);
  }, 0);
  const urgentes = activos.filter((p) => {
    const dias = diasParaCierre(p.fechaCierre);
    return dias !== null && dias >= 0 && dias <= 3;
  });

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-xl shadow-sm">
              🌿
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900 leading-tight">Verde Ecológico SAS</h1>
              <p className="text-xs text-slate-400">Agente SECOP II · Panel de procesos</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => scout.mutate()}
              disabled={scout.isPending}
              className="flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {scout.isPending ? (
                <>
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                  Buscando procesos...
                </>
              ) : (
                <>🔍 Scout</>
              )}
            </button>
            <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Activo
            </div>
          </div>
        </div>
      </header>

      {/* Resultado del Scout */}
      {scout.isSuccess && (
        <div className="mx-auto max-w-7xl px-6 pt-4">
          <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            <span>
              🔍 Scout: {scout.data.nuevos} proceso{scout.data.nuevos === 1 ? "" : "s"} nuevo
              {scout.data.nuevos === 1 ? "" : "s"} · {scout.data.duplicados} ya estaban en el tablero
              {scout.data.sinCupo > 0 ? ` · ${scout.data.sinCupo} sin cupo disponible` : ""}
              {" de "}
              {scout.data.encontrados} encontrados
            </span>
            <button onClick={() => scout.reset()} className="text-emerald-600 hover:text-emerald-800" aria-label="Cerrar">
              ✕
            </button>
          </div>
        </div>
      )}
      {scout.isError && (
        <div className="mx-auto max-w-7xl px-6 pt-4">
          <div className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <span>✗ Scout falló: {(scout.error as Error).message}</span>
            <button onClick={() => scout.reset()} className="text-red-600 hover:text-red-800" aria-label="Cerrar">
              ✕
            </button>
          </div>
        </div>
      )}

      <main className="mx-auto max-w-7xl px-6 py-8 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard
            icon="📋"
            title="Procesos activos"
            value={`${activos.length} / 30`}
            sub="cupo del tablero"
          />
          <StatCard
            icon="💰"
            title="Valor en juego"
            value={formatM(valorTotal)}
            sub="presupuesto oficial"
          />
          <StatCard
            icon="📈"
            title="Ganancia potencial"
            value={formatM(gananciaTotal)}
            sub="si se adjudican todos"
            color="emerald"
          />
          <StatCard
            icon="⏰"
            title="Cierran esta semana"
            value={urgentes.length.toString()}
            sub={urgentes.length === 0 ? "sin urgencia" : "en ≤ 3 días"}
            color={urgentes.length > 0 ? "amber" : "default"}
          />
        </div>

        {/* Error / Loading */}
        {isLoading && (
          <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-400 shadow-sm">
            Cargando procesos...
          </div>
        )}
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">
            No se pudo conectar con la API del dashboard.
          </div>
        )}

        {/* Table */}
        {!isLoading && !error && (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-6 py-4">
              <h2 className="text-sm font-semibold text-slate-800">Procesos detectados</h2>
              <p className="mt-0.5 text-xs text-slate-400">
                Haz clic en cualquier fila para ver detalles, analizar y aprobar
              </p>
            </div>
            <ProcesosTable procesos={activos} onSeleccionar={setSeleccionado} />
          </div>
        )}
      </main>

      {/* Panel de detalle */}
      {seleccionado && (
        <ProcesoDetail id={seleccionado} onCerrar={() => setSeleccionado(null)} />
      )}
    </div>
  );
}

function StatCard({
  icon,
  title,
  value,
  sub,
  color = "default",
}: {
  icon: string;
  title: string;
  value: string;
  sub: string;
  color?: "default" | "emerald" | "amber";
}) {
  const valueColor =
    color === "emerald"
      ? "text-emerald-600"
      : color === "amber"
      ? "text-amber-600"
      : "text-slate-900";
  const borderColor = color === "amber" ? "border-amber-200" : "border-slate-200";

  return (
    <div className={`rounded-xl border bg-white px-4 py-4 shadow-sm ${borderColor}`}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-base">{icon}</span>
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{title}</p>
      </div>
      <p className={`text-2xl font-bold ${valueColor}`}>{value}</p>
      <p className="mt-0.5 text-xs text-slate-400">{sub}</p>
    </div>
  );
}

export default App;
