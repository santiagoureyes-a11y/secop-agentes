import { z } from "zod";

// Campos del dataset "SECOP II - Procesos de Contratación" (p6dx-8zbt en datos.gov.co),
// verificados contra un registro real de la API SODA. Todos los valores llegan como string
// desde Socrata (incluso números y fechas), por eso se castean explícitamente.
export const ProcesoSchema = z.object({
  entidad: z.string().optional(),
  nit_entidad: z.string().optional(),
  departamento_entidad: z.string().optional(),
  ciudad_entidad: z.string().optional(),
  id_del_proceso: z.string(),
  referencia_del_proceso: z.string().optional(),
  nombre_del_procedimiento: z.string().optional(),
  descripci_n_del_procedimiento: z.string().optional(),
  fase: z.string().optional(),
  fecha_de_publicacion_del: z.string().optional(),
  fecha_de_recepcion_de: z.string().optional(),
  precio_base: z.string().optional(),
  modalidad_de_contratacion: z.string().optional(),
  duracion: z.string().optional(),
  unidad_de_duracion: z.string().optional(),
  estado_del_procedimiento: z.string().optional(),
  adjudicado: z.string().optional(),
  valor_total_adjudicacion: z.string().optional(),
  nombre_del_proveedor: z.string().optional(),
  nit_del_proveedor_adjudicado: z.string().optional(),
  codigo_principal_de_categoria: z.string().optional(),
  tipo_de_contrato: z.string().optional(),
  urlproceso: z.object({ url: z.string() }).optional(),
  codigo_entidad: z.string().optional(),
  estado_resumen: z.string().optional(),
});

export type Proceso = z.infer<typeof ProcesoSchema>;

// Perfil de la empresa: criterios de filtrado del Agente Scout.
// codigosUnspsc usa el "codigo_principal_de_categoria" del proceso (prefijo, ej. "8111" para 4 dígitos).
export interface PerfilEmpresa {
  codigosUnspsc: string[];
  departamentos?: string[];
  precioMinimo?: number;
  precioMaximo?: number;
  modalidades?: string[];
  // Búsqueda por palabras clave dentro del objeto del proceso (nombre y descripción del
  // procedimiento), sin acentos para evitar problemas de codificación entre fuentes de datos.
  // Se exige que TODAS las palabras estén presentes (AND). Para casos donde se necesita
  // "obligatoria + al menos una de un grupo", usar palabraClaveObligatoria + palabrasClaveAlguna.
  palabrasClaveObjeto?: string[];
  // Palabra que SIEMPRE debe estar presente (ej. "INTERVENTOR").
  palabraClaveObligatoria?: string;
  // De este grupo, basta con que aparezca AL MENOS UNA (OR) — evita excluir procesos cuyo
  // objeto no usa literalmente todas las palabras típicas (ej. "técnica y jurídica" sin "contable").
  palabrasClaveAlguna?: string[];
  // Solo procesos publicados en los últimos N días respecto al momento de la consulta.
  diasPublicacionMax?: number;
  // Si es true (default), excluye procesos ya adjudicados o cuya fecha de recepción de
  // respuestas ya pasó — evita mostrar candidatos en los que ya no se puede ofertar.
  soloVigentes?: boolean;
  // Días completos que deben faltar para el cierre al momento del triage. Datos Abiertos
  // trunca la hora de cierre a las 00:00, así que un proceso que cierra "el día D" puede
  // cerrar a primera hora de D; para garantizar N días completos se exige que la fecha de
  // cierre sea >= hoy + N + 1 (en fecha de Bogotá). Solo aplica con soloVigentes.
  diasMinimosAntesCierre?: number;
}
