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

export function crearProceso(datos: CrearProcesoInput) {
  return prisma.proceso.upsert({
    where: { idProceso: datos.idProceso },
    update: datos,
    create: datos,
  });
}

export async function actualizarEstado(id: string, datos: ActualizarEstadoInput) {
  const proceso = await prisma.proceso.update({ where: { id }, data: { estado: datos.estado } });
  // Gate 2: aviso (no aprobación) cuando los documentos ya están listos para radicar.
  if (datos.estado === "aprobado_radicar") {
    await notificarListoParaPublicar(proceso);
  }
  return proceso;
}

export function eliminarProceso(id: string) {
  return prisma.proceso.delete({ where: { id } });
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
  // Gate 1: aviso (no aprobación) con el costeo y la ganancia esperada.
  await notificarCostoYGanancia(proceso);
  return proceso;
}
