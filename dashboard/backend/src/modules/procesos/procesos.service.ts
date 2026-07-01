import { prisma } from "../../config/prisma.js";
import type {
  ActualizarEstadoSchema,
  CrearProcesoSchema,
  RecomendacionFinancieraSchema,
} from "./procesos.schema.js";
import { z } from "zod";
import { notificarCostoYGanancia, notificarListoParaPublicar } from "./procesos.notificaciones.js";

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

export async function guardarRecomendacionFinanciera(id: string, datos: RecomendacionFinancieraInput) {
  const proceso = await prisma.proceso.update({
    where: { id },
    data: { ...datos, estado: "cotizado" },
  });
  // Gate 1: aviso (no aprobación) con el costeo y la ganancia esperada.
  await notificarCostoYGanancia(proceso);
  return proceso;
}
