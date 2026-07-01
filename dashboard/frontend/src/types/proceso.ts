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

export type EstadoProceso = (typeof ESTADOS_PROCESO)[number];

export interface Empresa {
  id: string;
  nombre: string;
  nit: string;
}

export const TIPOS_DOCUMENTO = [
  "carta_presentacion",
  "oferta_economica",
  "anexo_tecnico",
  "garantia",
  "otro",
] as const;

export type TipoDocumento = (typeof TIPOS_DOCUMENTO)[number];
export type EstadoDocumento = "generado" | "cargado" | "confirmado";

export interface DocumentoProceso {
  id: string;
  procesoId: string;
  tipo: TipoDocumento;
  rutaArchivo: string;
  estado: EstadoDocumento;
  createdAt: string;
}

export const ETIQUETAS_TIPO_DOCUMENTO: Record<TipoDocumento, string> = {
  carta_presentacion: "Carta de presentación",
  oferta_economica: "Oferta económica",
  anexo_tecnico: "Anexo técnico",
  garantia: "Garantía de seriedad",
  otro: "Otro",
};

export interface Proceso {
  id: string;
  idProceso: string;
  entidad: string;
  objeto: string;
  valorBase: number | null;
  modalidad: string | null;
  fechaCierre: string | null;
  urlProceso: string | null;
  estado: EstadoProceso;
  valorSugerido: number | null;
  margenEsperado: number | null;
  riesgo: string | null;
  resumenPliego: string | null;
  empresaId: string | null;
  empresa: Empresa | null;
  documentos: DocumentoProceso[];
  createdAt: string;
  updatedAt: string;
}

export const ETIQUETAS_ESTADO: Record<EstadoProceso, string> = {
  por_revisar: "Por revisar",
  aprobado_cotizar: "Aprobado para cotizar",
  descartado: "Descartado",
  cotizado: "Cotizado",
  aprobado_radicar: "Aprobado para radicar",
  radicado: "Radicado",
  en_evaluacion: "En evaluación",
  adjudicado: "Adjudicado",
  rechazado: "Rechazado",
};

export const COLOR_ESTADO: Record<EstadoProceso, string> = {
  por_revisar: "bg-amber-100 text-amber-800",
  aprobado_cotizar: "bg-sky-100 text-sky-800",
  descartado: "bg-zinc-100 text-zinc-600",
  cotizado: "bg-emerald-100 text-emerald-800",
  aprobado_radicar: "bg-indigo-100 text-indigo-800",
  radicado: "bg-blue-100 text-blue-800",
  en_evaluacion: "bg-purple-100 text-purple-800",
  adjudicado: "bg-green-100 text-green-800",
  rechazado: "bg-red-100 text-red-800",
};
