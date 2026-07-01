import { prisma } from "../../config/prisma.js";
import type { z } from "zod";
import type { ActualizarEstadoDocumentoSchema, CrearDocumentoSchema } from "./documentos.schema.js";

type CrearDocumentoInput = z.infer<typeof CrearDocumentoSchema>;
type ActualizarEstadoInput = z.infer<typeof ActualizarEstadoDocumentoSchema>;

export function listarDocumentosDeProceso(procesoId: string) {
  return prisma.documentoProceso.findMany({
    where: { procesoId },
    orderBy: { createdAt: "asc" },
  });
}

export function crearDocumento(datos: CrearDocumentoInput) {
  return prisma.documentoProceso.create({ data: datos });
}

export function actualizarEstadoDocumento(id: string, datos: ActualizarEstadoInput) {
  return prisma.documentoProceso.update({ where: { id }, data: datos });
}
