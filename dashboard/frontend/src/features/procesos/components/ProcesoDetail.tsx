import { useProceso, useActualizarEstado, useArchivosDescargados } from "../hooks/useProcesos";
import { ETIQUETAS_TIPO_DOCUMENTO, TIPOS_DOCUMENTO, type TipoDocumento } from "../../../types/proceso";

function formatearMoneda(valor: number | null) {
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

  if (isLoading || !proceso) return <p className="text-zinc-400">Cargando proceso...</p>;

  const cambiarEstado = (estado: Parameters<typeof actualizarEstado.mutate>[0]["estado"]) =>
    actualizarEstado.mutate({ id: proceso.id, estado });

  return (
    <div className="space-y-6 rounded-lg border border-zinc-200 p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-zinc-400">
            {proceso.idProceso} {proceso.empresa && `· se presenta como ${proceso.empresa.nombre}`}
          </p>
          <h2 className="text-lg font-medium text-zinc-900">{proceso.entidad}</h2>
          <p className="text-sm text-zinc-600">{proceso.objeto}</p>
        </div>
        <button onClick={onCerrar} className="text-sm text-zinc-400 hover:text-zinc-700">
          Cerrar
        </button>
      </div>

      <section>
        <h3 className="mb-2 text-sm font-semibold text-zinc-700">Resumen del Scout</h3>
        <dl className="grid grid-cols-2 gap-2 text-sm">
          <dt className="text-zinc-400">Valor base</dt>
          <dd>{formatearMoneda(proceso.valorBase)}</dd>
          <dt className="text-zinc-400">Modalidad</dt>
          <dd>{proceso.modalidad ?? "—"}</dd>
        </dl>
        {proceso.urlProceso && (
          <a
            href={proceso.urlProceso}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-block text-sm text-indigo-600 hover:underline"
          >
            Ver proceso en SECOP →
          </a>
        )}
      </section>

      {archivos.length > 0 && (
        <section className="border-t border-zinc-100 pt-4">
          <h3 className="mb-2 text-sm font-semibold text-zinc-700">Documentos del pliego</h3>
          <ul className="space-y-1">
            {archivos.map((archivo) => (
              <li key={archivo.nombre}>
                <a
                  href={archivo.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 text-sm text-indigo-600 hover:underline"
                >
                  <span>📄</span>
                  <span>{archivo.nombre}</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {proceso.resumenPliego && (
        <section className="border-t border-zinc-100 pt-4">
          <details>
            <summary className="cursor-pointer text-sm font-semibold text-zinc-700">
              Resumen del pliego (experiencia, perfiles, plazo, alcance)
            </summary>
            <pre className="mt-2 max-h-96 overflow-y-auto whitespace-pre-wrap rounded-md bg-zinc-50 p-3 text-xs text-zinc-700">
              {proceso.resumenPliego}
            </pre>
          </details>
        </section>
      )}

      {proceso.estado === "por_revisar" && (
        <section className="flex gap-2 border-t border-zinc-100 pt-4">
          <button
            onClick={() => cambiarEstado("aprobado_cotizar")}
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
          >
            Aprobar y cotizar
          </button>
          <button
            onClick={() => cambiarEstado("descartado")}
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50"
          >
            Descartar
          </button>
        </section>
      )}

      {proceso.estado === "cotizado" && proceso.valorSugerido !== null && (
        <section className="space-y-3 border-t border-zinc-100 pt-4">
          <h3 className="text-sm font-semibold text-zinc-700">Análisis financiero</h3>
          {(() => {
            const propuesta = proceso.valorSugerido!;
            const margen = proceso.margenEsperado ?? 0;
            // costo = propuesta / (1 + margen)  →  ganancia = propuesta - costo
            const costo = margen > 0 ? propuesta / (1 + margen) : propuesta;
            const ganancia = propuesta - costo;
            const pctDesc = proceso.valorBase
              ? ((1 - propuesta / proceso.valorBase) * 100).toFixed(1)
              : null;

            const colorGanancia =
              ganancia < 500_000
                ? "text-red-600 font-semibold"
                : ganancia < 2_000_000
                ? "text-amber-600 font-semibold"
                : "text-emerald-700 font-semibold";

            const badgeRiesgo =
              proceso.riesgo === "alto"
                ? "bg-red-100 text-red-700"
                : proceso.riesgo === "medio"
                ? "bg-amber-100 text-amber-700"
                : "bg-emerald-100 text-emerald-700";

            return (
              <>
                <dl className="grid grid-cols-2 gap-y-2 text-sm">
                  <dt className="text-zinc-400">Presupuesto oficial</dt>
                  <dd>{formatearMoneda(proceso.valorBase)}</dd>

                  <dt className="text-zinc-400">Propuesta a radicar</dt>
                  <dd className="font-medium">{formatearMoneda(propuesta)}</dd>

                  <dt className="text-zinc-400">Descuento sobre presupuesto</dt>
                  <dd>{pctDesc ? `${pctDesc}%` : "—"}</dd>

                  <dt className="text-zinc-400">Costo estimado Verde Ecológico</dt>
                  <dd>{formatearMoneda(Math.round(costo))}</dd>

                  <dt className="text-zinc-400">Ganancia estimada</dt>
                  <dd className={colorGanancia}>{formatearMoneda(Math.round(ganancia))}</dd>

                  <dt className="text-zinc-400">Margen sobre costo</dt>
                  <dd>{margen > 0 ? `${(margen * 100).toFixed(1)}%` : "—"}</dd>

                  <dt className="text-zinc-400">Riesgo</dt>
                  <dd>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badgeRiesgo}`}>
                      {proceso.riesgo?.toUpperCase() ?? "—"}
                    </span>
                  </dd>
                </dl>

                {ganancia < 500_000 && (
                  <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
                    ⚠ Ganancia muy baja ({formatearMoneda(Math.round(ganancia))}). Evalúa si conviene participar.
                  </p>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={() => cambiarEstado("aprobado_radicar")}
                    className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                  >
                    Aprobar para radicar
                  </button>
                </div>
              </>
            );
          })()}
        </section>
      )}

      {(proceso.estado === "cotizado" || proceso.estado === "aprobado_radicar") && (
        <section className="space-y-2 border-t border-zinc-100 pt-4 text-sm">
          <h3 className="font-semibold text-zinc-700">Documentos de la oferta</h3>
          <ul className="space-y-1">
            {TIPOS_DOCUMENTO.map((tipo) => {
              const doc = proceso.documentos.find((d) => d.tipo === tipo);
              return (
                <li key={tipo} className="flex items-center gap-2">
                  <span>{doc ? (doc.estado === "confirmado" ? "✅" : "🟡") : "⚠️"}</span>
                  <span className="text-zinc-700">{ETIQUETAS_TIPO_DOCUMENTO[tipo as TipoDocumento]}</span>
                  <span className="text-zinc-400">{doc ? `(${doc.estado})` : "(pendiente)"}</span>
                </li>
              );
            })}
          </ul>
          <p className="text-zinc-400">
            La radicación final (login + captcha + clic de enviar) siempre la hace un humano en
            la plataforma real.
          </p>
        </section>
      )}
    </div>
  );
}
