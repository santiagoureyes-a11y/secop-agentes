import { prisma } from "../../config/prisma.js";
import type {
  ActualizarEstadoSchema,
  CrearProcesoSchema,
  RecomendacionFinancieraSchema,
} from "./procesos.schema.js";
import { z } from "zod";
import { notificarCostoYGanancia, notificarListoParaPublicar } from "./procesos.notificaciones.js";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

type CrearProcesoInput = z.infer<typeof CrearProcesoSchema>;
type ActualizarEstadoInput = z.infer<typeof ActualizarEstadoSchema>;
type RecomendacionFinancieraInput = z.infer<typeof RecomendacionFinancieraSchema>;

export function listarProcesos() {
  return prisma.proceso.findMany({
    orderBy: { fechaCierre: "asc" },
    include: { empresa: true, documentos: true },
  });
}

export function obtenerProceso(id: string) {
  return prisma.proceso.findUnique({ where: { id }, include: { empresa: true, documentos: true } });
}

export async function crearProceso(datos: CrearProcesoInput) {
  const existente = await prisma.proceso.findUnique({ where: { idProceso: datos.idProceso } });
  if (existente && (existente.estado === "rechazado" || existente.estado === "descartado")) {
    return null;
  }
  // Si sesion-asistida ya confirmó la hora exacta de cierre, el Scout (que solo trae el día,
  // con hora 00:00 desde Datos Abiertos) no debe pisarla en sus corridas siguientes.
  const update: Partial<CrearProcesoInput> = { ...datos };
  if (existente?.horaCierreConfirmada) delete update.fechaCierre;
  return prisma.proceso.upsert({
    where: { idProceso: datos.idProceso },
    update,
    create: datos,
  });
}

export function actualizarFechaCierre(id: string, fechaCierre: Date) {
  return prisma.proceso.update({
    where: { id },
    data: { fechaCierre, horaCierreConfirmada: true },
  });
}

export async function actualizarEstado(id: string, datos: ActualizarEstadoInput) {
  const proceso = await prisma.proceso.update({ where: { id }, data: { estado: datos.estado } });
  // Gate 2: aviso (no aprobación) — best effort, no bloquea si el SMTP falla.
  if (datos.estado === "aprobado_radicar") {
    notificarListoParaPublicar(proceso).catch((err) =>
      console.warn("[email] No se pudo enviar aviso de radicación:", (err as Error).message)
    );
  }
  return proceso;
}

export function eliminarProceso(id: string) {
  return prisma.proceso.delete({ where: { id } });
}

const ESTADOS_PRE_RADICACION = ["por_revisar", "aprobado_cotizar", "cotizado", "aprobado_radicar"];
const ESTADOS_TERMINALES = ["descartado", "rechazado", "adjudicado"];
const CUPO_MAXIMO = Number(process.env.MAX_PROCESOS_ACTIVOS ?? 30);

// Depura el tablero para que no se convierta en "un SECOP 2.0": descarta los procesos sin
// radicar a los que les queda menos de 1 día para el cierre (ya no hay tiempo de preparar
// garantía/CCB/documentos) y reporta el cupo disponible para que el Scout no exceda el
// máximo de procesos activos. El Scout la llama antes de insertar en cada corrida diaria.
export async function depurarProcesos() {
  const candidatos = await prisma.proceso.findMany({
    where: { estado: { in: ESTADOS_PRE_RADICACION }, fechaCierre: { not: null } },
  });

  // Umbral: cierre a menos de 1 día. Con hora confirmada se compara el instante real;
  // sin confirmar solo se conoce el día (00:00 UTC de Datos Abiertos), así que se compara
  // el día calendario en Bogotá: cierre <= mañana ⇒ podría cerrar en cualquier momento
  // de mañana a primera hora, o sea, queda menos de 1 día completo garantizado.
  const ahora = Date.now();
  const MS_DIA = 24 * 60 * 60 * 1000;
  const maniana = new Date(ahora + MS_DIA).toLocaleDateString("en-CA", { timeZone: "America/Bogota" });

  const vencidos = candidatos.filter((p) => {
    if (p.horaCierreConfirmada) return p.fechaCierre!.getTime() - ahora < MS_DIA;
    return p.fechaCierre!.toISOString().slice(0, 10) <= maniana;
  });

  for (const proceso of vencidos) {
    await prisma.proceso.update({
      where: { id: proceso.id },
      data: {
        estado: "descartado",
        motivoDescarte: proceso.estado === "por_revisar" ? "vencido sin aprobar" : "cerró sin radicar",
      },
    });
  }

  const activos = await prisma.proceso.count({ where: { estado: { notIn: ESTADOS_TERMINALES } } });
  return {
    descartados: vencidos.length,
    activos,
    cupoMaximo: CUPO_MAXIMO,
    cupoDisponible: Math.max(0, CUPO_MAXIMO - activos),
  };
}

const uploadsDir = process.env.UPLOADS_DIR ?? path.join(process.cwd(), "uploads");

function dirUploads(idProceso: string) {
  return path.join(uploadsDir, idProceso);
}

function dirLocal(nit: string, idProceso: string) {
  return path.join(os.homedir(), "secop-documentos", nit, "descargados", idProceso);
}

export async function listarArchivosDescargados(id: string) {
  const proceso = await prisma.proceso.findUnique({ where: { id }, include: { empresa: true } });
  if (!proceso) return [];

  const archivos = new Map<string, { nombre: string; url: string }>();

  // Archivos en uploads/ del servidor (Railway)
  const dirUp = dirUploads(proceso.idProceso);
  if (fs.existsSync(dirUp)) {
    for (const f of fs.readdirSync(dirUp).filter((f) => !f.startsWith("."))) {
      archivos.set(f, { nombre: f, url: `/api/procesos/${id}/archivos/${encodeURIComponent(f)}` });
    }
  }

  // Archivos locales en ~/secop-documentos (solo disponibles en el equipo del operador)
  if (proceso.empresa) {
    const dirLoc = dirLocal(proceso.empresa.nit, proceso.idProceso);
    if (fs.existsSync(dirLoc)) {
      for (const f of fs.readdirSync(dirLoc).filter((f) => !f.startsWith("."))) {
        if (!archivos.has(f)) {
          archivos.set(f, { nombre: f, url: `/api/procesos/${id}/archivos/${encodeURIComponent(f)}` });
        }
      }
    }
  }

  return Array.from(archivos.values());
}

export async function rutaArchivoDescargado(id: string, filename: string) {
  const proceso = await prisma.proceso.findUnique({ where: { id }, include: { empresa: true } });
  if (!proceso) return null;

  const rutaUp = path.join(dirUploads(proceso.idProceso), filename);
  if (fs.existsSync(rutaUp)) return rutaUp;

  if (proceso.empresa) {
    const rutaLoc = path.join(dirLocal(proceso.empresa.nit, proceso.idProceso), filename);
    if (fs.existsSync(rutaLoc)) return rutaLoc;
  }

  return null;
}

export async function guardarArchivoSubido(idProceso: string, filename: string, buffer: Buffer) {
  const dir = dirUploads(idProceso);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, filename), buffer);
}

export async function guardarRecomendacionFinanciera(id: string, datos: RecomendacionFinancieraInput) {
  const proceso = await prisma.proceso.update({
    where: { id },
    data: { ...datos, estado: "cotizado" },
  });
  // Gate 1: aviso (no aprobación) — best effort, no bloquea si el SMTP falla.
  notificarCostoYGanancia(proceso).catch((err) =>
    console.warn("[email] No se pudo enviar aviso de costeo:", (err as Error).message)
  );
  return proceso;
}
