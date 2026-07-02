import { useProceso, useActualizarEstado, useArchivosDescargados } from "../hooks/useProcesos";
import { ETIQUETAS_TIPO_DOCUMENTO, TIPOS_DOCUMENTO, type TipoDocumento, type Proceso } from "../../../types/proceso";

function fmt(valor: number | null) {
  if (valor === null) return "—";
  return valor.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
}

interface ProcesoDetailProps {
  id: string;
  onCerrar: () => void;
}

export function ProcesoDetail({ id, onCerrar }: ProcesoDetailProps) {
  const { data: proceso, isLoading } = useProceso(id);
  const { data: archivos = [] } = useArchivosDescargados(id);
  const actualizarEstado = useActualizarEstado();

  const cambiarEstado = (estado: Parameters<typeof actualizarEstado.mutate>[0]["estado"]) =>
    actualizarEstado.mutate({ id: proceso!.id, estado });

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/25 backdrop-blur-sm"
        onClick={onCerrar}
      />

      {/* Panel lateral derecho */}
      <div className="fixed right-0 top-0 bottom-0 z-50 flex w-full max-w-xl flex-col bg-white shadow-2xl">
        {/* Header del panel */}
        <div className="sticky top-0 z-10 border-b border-slate-100 bg-white px-6 py-4">
          {isLoading || !proceso ? (
            <div className="h-12 animate-pulse rounded-lg bg-slate-100" />
          ) : (
            <div className="flex items-start gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-mono text-slate-400">{proceso.idProceso}</p>
                <h2 className="mt-0.5 text-base font-bold text-slate-900 leading-snug">
                  {proceso.entidad}
                </h2>
                <p className="mt-1 text-sm text-slate-500 line-clamp-2">{proceso.objeto}</p>
              </div>
              <button
                onClick={onCerrar}
                className="flex-shrink-0 rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}
        </div>

        {/* Cuerpo del panel */}
        {!isLoading && proceso && (
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
            {/* Info base */}
            <div className="grid grid-cols-2 gap-3">
              <InfoCard label="Modalidad" value={proceso.modalidad ?? "—"} />
              <InfoCard label="Presupuesto oficial" value={fmt(proceso.valorBase)} highlight />
            </div>
            {proceso.urlProceso && (
              <a
                href={proceso.urlProceso}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-800"
              >
                Ver proceso en SECOP II
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            )}

            {/* Documentos del pliego */}
            {archivos.length > 0 && (
              <Section title="Documentos del pliego">
                <ul className="space-y-2">
                  {archivos.map((archivo) => (
                    <li key={archivo.nombre}>
                      <a
                        href={archivo.url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 transition-colors hover:bg-slate-100"
                      >
                        <span className="text-slate-400 text-base">📄</span>
                        <span className="flex-1 truncate">{archivo.nombre}</span>
                        <span className="text-xs text-indigo-500 flex-shrink-0 font-medium">↓</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            {/* Resumen del pliego */}
            {proceso.resumenPliego && (
              <Section title="Resumen del pliego">
                <details>
                  <summary className="cursor-pointer text-sm text-slate-500 hover:text-slate-700 select-none">
                    Ver resumen (experiencia, perfiles, alcance)
                  </summary>
                  <pre className="mt-3 max-h-64 overflow-y-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-4 text-xs text-slate-600 leading-relaxed">
                    {proceso.resumenPliego}
                  </pre>
                </details>
              </Section>
            )}

            {/* Análisis financiero */}
            {proceso.valorSugerido !== null &&
              (proceso.estado === "cotizado" || proceso.estado === "aprobado_radicar") && (
                <Section title="Análisis financiero">
                  <AnalisisFinanciero proceso={proceso} />
                </Section>
              )}

            {/* Acciones */}
            {proceso.estado === "por_revisar" && (
              <Section title="Acción requerida">
                <div className="flex gap-2">
                  <button
                    onClick={() => cambiarEstado("aprobado_cotizar")}
                    className="flex-1 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700"
                  >
                    Aprobar y cotizar
                  </button>
                  <button
                    onClick={() => cambiarEstado("descartado")}
                    className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
                  >
                    Descartar
                  </button>
                </div>
              </Section>
            )}

            {proceso.estado === "cotizado" && proceso.valorSugerido !== null && (
              <button
                onClick={() => cambiarEstado("aprobado_radicar")}
                className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700"
              >
                Aprobar para radicar
              </button>
            )}

            {/* Checklist documentos de oferta */}
            {(proceso.estado === "cotizado" || proceso.estado === "aprobado_radicar") && (
              <Section title="Documentos de la oferta">
                <ul className="space-y-2">
                  {TIPOS_DOCUMENTO.map((tipo) => {
                    const doc = proceso.documentos.find((d) => d.tipo === tipo);
                    return (
                      <li key={tipo} className="flex items-center gap-3 text-sm">
                        <span className="text-base leading-none">
                          {doc
                            ? doc.estado === "confirmado"
                              ? "✅"
                              : "🟡"
                            : "⬜"}
                        </span>
                        <span className={doc ? "text-slate-700" : "text-slate-400"}>
                          {ETIQUETAS_TIPO_DOCUMENTO[tipo as TipoDocumento]}
                        </span>
                        {doc && (
                          <span className="ml-auto text-xs text-slate-400 capitalize">{doc.estado}</span>
                        )}
                      </li>
                    );
                  })}
                </ul>
                <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2.5 text-xs text-slate-400 leading-relaxed">
                  La radicación final (login + captcha + envío) siempre la hace un humano directamente en SECOP II.
                </p>
              </Section>
            )}
          </div>
        )}
      </div>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-slate-100 pt-5">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">{title}</h3>
      {children}
    </section>
  );
}

function InfoCard({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
      <p className="text-xs text-slate-400">{label}</p>
      <p className={`mt-0.5 text-sm font-semibold ${highlight ? "text-emerald-700" : "text-slate-800"}`}>
        {value}
      </p>
    </div>
  );
}

function AnalisisFinanciero({ proceso }: { proceso: Proceso }) {
  const propuesta = proceso.valorSugerido!;
  const margen = proceso.margenEsperado ?? 0;
  const costo = margen > 0 ? propuesta / (1 + margen) : propuesta;
  const ganancia = propuesta - costo;
  const pctDesc = proceso.valorBase
    ? ((1 - propuesta / proceso.valorBase) * 100).toFixed(1)
    : null;

  const colorGanancia =
    ganancia < 500_000
      ? "text-red-600"
      : ganancia < 2_000_000
      ? "text-amber-600"
      : "text-emerald-600";

  const badgeRiesgo =
    proceso.riesgo === "alto"
      ? "bg-red-100 text-red-700"
      : proceso.riesgo === "medio"
      ? "bg-amber-100 text-amber-700"
      : "bg-emerald-100 text-emerald-700";

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-xl border border-slate-100 divide-y divide-slate-100">
        <FinRow label="Presupuesto oficial" value={fmt(proceso.valorBase)} />
        <FinRow label="Propuesta a radicar" value={fmt(propuesta)} bold />
        {pctDesc && <FinRow label="Descuento sobre presupuesto" value={`${pctDesc}%`} />}
        <FinRow label="Costo estimado Verde Ecológico" value={fmt(Math.round(costo))} />
        <FinRow
          label="Ganancia estimada"
          value={fmt(Math.round(ganancia))}
          valueClassName={`font-bold ${colorGanancia}`}
        />
        <FinRow
          label="Margen sobre costo"
          value={margen > 0 ? `${(margen * 100).toFixed(1)}%` : "—"}
        />
        <div className="flex items-center justify-between bg-white px-4 py-3 text-sm">
          <span className="text-slate-400">Riesgo</span>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${badgeRiesgo}`}>
            {proceso.riesgo?.toUpperCase() ?? "—"}
          </span>
        </div>
      </div>

      {ganancia < 500_000 && (
        <div className="flex items-start gap-2.5 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span className="flex-shrink-0">⚠</span>
          <span>
            Ganancia muy baja ({fmt(Math.round(ganancia))}). El gerente debe decidir si conviene participar.
          </span>
        </div>
      )}
    </div>
  );
}

function FinRow({
  label,
  value,
  bold = false,
  valueClassName,
}: {
  label: string;
  value: string;
  bold?: boolean;
  valueClassName?: string;
}) {
  return (
    <div className="flex items-center justify-between bg-white px-4 py-3 text-sm">
      <span className="text-slate-400">{label}</span>
      <span className={valueClassName ?? (bold ? "font-bold text-slate-900" : "text-slate-700")}>
        {value}
      </span>
    </div>
  );
}
