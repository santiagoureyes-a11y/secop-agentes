import { z } from "zod";

export const ESTADOS_PROCESO = [
  "por_revisar",
  "aprobado_cotizar",
  "descartado",
  "cotizado",
  "aprobado_radicar",
  "radicado",
  "en_evaluacion",
  "adjudicado",
  "rechazado",
] as const;

export const CrearProcesoSchema = z.object({
  idProceso: z.string().min(1),
  entidad: z.string().min(1),
  objeto: z.string().min(1),
  valorBase: z.number().nonnegative().optional(),
  modalidad: z.string().optional(),
  fechaCierre: z.coerce.date().optional(),
  urlProceso: z.string().url().optional(),
  empresaId: z.string().optional(),
  resumenPliego: z.string().optional(),
});

export const ActualizarEstadoSchema = z.object({
  estado: z.enum(ESTADOS_PROCESO),
});

// La fecha debe venir como instante ISO completo con offset (ej. "2026-07-08T09:00:00-05:00",
// hora de Colombia) — un date-time sin zona se interpretaría con la del servidor.
export const FechaCierreSchema = z.object({
  fechaCierre: z.coerce.date(),
});

export const RecomendacionFinancieraSchema = z.object({
  valorSugerido: z.number().nonnegative(),
  margenEsperado: z.number(),
  riesgo: z.string(),
});
