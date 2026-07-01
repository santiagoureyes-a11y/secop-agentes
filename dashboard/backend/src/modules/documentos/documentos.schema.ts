import { z } from "zod";

export const TIPOS_DOCUMENTO = [
  "carta_presentacion",
  "oferta_economica",
  "anexo_tecnico",
  "garantia",
  "otro",
] as const;

export const ESTADOS_DOCUMENTO = ["generado", "cargado", "confirmado"] as const;

export const CrearDocumentoSchema = z.object({
  procesoId: z.string().min(1),
  tipo: z.enum(TIPOS_DOCUMENTO),
  rutaArchivo: z.string().min(1),
});

export const ActualizarEstadoDocumentoSchema = z.object({
  estado: z.enum(ESTADOS_DOCUMENTO),
});
