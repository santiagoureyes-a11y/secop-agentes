import { z } from "zod";
import { prisma } from "../../config/prisma.js";
import * as procesosService from "../procesos/procesos.service.js";

/**
 * Versión backend del Agente Scout (scout/src/index.ts + scout/src/client.ts), para poder
 * dispararlo desde un botón del dashboard sin depender de la máquina local de Santiago —
 * este servicio no usa Chrome/Playwright, solo hace fetch a la API pública de Datos
 * Abiertos, así que corre perfectamente en el mismo proceso que ya está en Railway.
 *
 * No se importa el paquete `scout/` directamente porque el backend compila con
 * `rootDir: "src"` (ver tsconfig.json) y tsc rechaza imports fuera de esa carpeta — se
 * duplica la lógica de consulta a Socrata en vez de reestructurar el build de producción.
 */

const DATASET_PROCESOS = "p6dx-8zbt";
const BASE_URL = "https://www.datos.gov.co/resource";

// Perfil de Verde Ecológico — igual al de scout/src/index.ts. Si el negocio cambia de
// nicho, actualizar en ambos lugares (o, mejor, mover a un JSON compartido).
//
// ⚠ Se quitó "palabrasClaveAlguna: [TECNIC, ADMINISTRATIV, CONTABLE]" (2026-07-30): medido
// contra Datos Abiertos, ese filtro extra descartaba procesos de interventoría reales (ej.
// interventoría topográfica) sin aportar precisión — el cuello de botella real es que el
// pool de "Mínima cuantía + interventoría" vigente en todo el país es naturalmente pequeño
// (1-2 procesos en un día cualquiera, ~41 si se cuentan todas las modalidades). Correr el
// scout con frecuencia (diario) es lo que acumula volumen real, no ampliar precio/fecha —
// eso ya se probó contra el dataset real y no cambia el conteo.
const PERFIL_VERDE_ECOLOGICO = {
  modalidades: ["Mínima cuantía"],
  palabraClaveObligatoria: "INTERVENTOR",
  precioMaximo: 200_000_000,
  diasPublicacionMax: 30,
  diasMinimosAntesCierre: 1,
};

const ProcesoSchema = z.object({
  entidad: z.string().optional(),
  id_del_proceso: z.string(),
  nombre_del_procedimiento: z.string().optional(),
  descripci_n_del_procedimiento: z.string().optional(),
  fecha_de_recepcion_de: z.string().optional(),
  precio_base: z.string().optional(),
  modalidad_de_contratacion: z.string().optional(),
  urlproceso: z.object({ url: z.string() }).optional(),
});
type ProcesoDatosAbiertos = z.infer<typeof ProcesoSchema>;

function fechaBogota(diasAdelante: number): string {
  const fecha = new Date(Date.now() + diasAdelante * 24 * 60 * 60 * 1000);
  return fecha.toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
}

function buildWhereClause(): string {
  const p = PERFIL_VERDE_ECOLOGICO;
  const condiciones: string[] = [];

  condiciones.push(`precio_base <= '${p.precioMaximo}'`);
  condiciones.push(`(${p.modalidades.map((m) => `modalidad_de_contratacion = '${m}'`).join(" OR ")})`);
  condiciones.push(
    `(upper(nombre_del_procedimiento) like '%${p.palabraClaveObligatoria}%' OR upper(descripci_n_del_procedimiento) like '%${p.palabraClaveObligatoria}%')`
  );

  const desde = new Date(Date.now() - p.diasPublicacionMax * 24 * 60 * 60 * 1000);
  condiciones.push(`fecha_de_publicacion_del >= '${desde.toISOString().slice(0, 10)}'`);

  const minCierre = fechaBogota(p.diasMinimosAntesCierre + 1);
  condiciones.push(`adjudicado = 'No'`);
  condiciones.push(`fecha_de_recepcion_de >= '${minCierre}'`);

  return condiciones.join(" AND ");
}

async function buscarProcesosDatosAbiertos(): Promise<ProcesoDatosAbiertos[]> {
  const params = new URLSearchParams({
    $limit: "50",
    $order: "fecha_de_publicacion_del DESC",
    $where: buildWhereClause(),
  });
  const res = await fetch(`${BASE_URL}/${DATASET_PROCESOS}.json?${params.toString()}`);
  if (!res.ok) throw new Error(`SECOP Datos Abiertos respondió ${res.status}: ${await res.text()}`);
  return ProcesoSchema.array().parse(await res.json());
}

export interface ResultadoScout {
  encontrados: number;
  nuevos: number;
  duplicados: number;
  sinCupo: number;
  cupoMaximo: number;
  cupoDisponible: number;
  procesosNuevos: Array<{ idProceso: string; entidad: string; valorBase: number | null }>;
}

export async function ejecutarScout(): Promise<ResultadoScout> {
  const depuracion = await procesosService.depurarProcesos();

  const empresa = await prisma.empresa.findFirst();
  if (!empresa) throw new Error("No hay ninguna empresa registrada en la base de datos");

  const procesos = await buscarProcesosDatosAbiertos();
  procesos.sort((a, b) => parseFloat(b.precio_base ?? "0") - parseFloat(a.precio_base ?? "0"));

  let nuevos = 0;
  let duplicados = 0;
  let sinCupo = 0;
  const procesosNuevos: ResultadoScout["procesosNuevos"] = [];

  for (const p of procesos) {
    if (nuevos >= depuracion.cupoDisponible) {
      sinCupo++;
      continue;
    }
    const valorBase = p.precio_base ? parseFloat(p.precio_base) : undefined;
    const resultado = await procesosService.crearProceso({
      idProceso: p.id_del_proceso,
      entidad: p.entidad ?? "Desconocida",
      objeto: p.nombre_del_procedimiento ?? p.descripci_n_del_procedimiento ?? "",
      valorBase,
      modalidad: p.modalidad_de_contratacion,
      fechaCierre: p.fecha_de_recepcion_de ? new Date(p.fecha_de_recepcion_de) : undefined,
      urlProceso: p.urlproceso?.url,
      empresaId: empresa.id,
    });
    if (resultado) {
      nuevos++;
      procesosNuevos.push({ idProceso: p.id_del_proceso, entidad: p.entidad ?? "Desconocida", valorBase: valorBase ?? null });
    } else {
      duplicados++;
    }
  }

  return {
    encontrados: procesos.length,
    nuevos,
    duplicados,
    sinCupo,
    cupoMaximo: depuracion.cupoMaximo,
    cupoDisponible: depuracion.cupoDisponible,
    procesosNuevos,
  };
}
