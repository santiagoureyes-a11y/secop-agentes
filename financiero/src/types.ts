// Estructura de costos según `docs/empresa/formula-cotizacion-interventoria.md`,
// transcrita de la plantilla real de Verde Ecológico (Anexo Oferta Económica).

export interface ItemPersonal {
  rol: string;
  cantidad: number;
  sueldoBasicoMes: number;
  // Porcentaje de dedicación al proceso (0-1), ej. 0.5 = medio tiempo.
  pctDedicacion: number;
}

export interface ItemCostoMensual {
  item: string;
  valorUnitarioMes: number;
}

export interface InsumoCotizacion {
  duracionMeses: number;
  personal: ItemPersonal[];
  // Costos de pólizas/impuestos de perfeccionamiento: valor global para todo el contrato
  // (no escala automáticamente por mes — en la práctica suele depender del valor/plazo del
  // contrato como tramo, no de una tarifa mensual lineal).
  costosPerfeccionamientoGLB: number;
  // Prestaciones sociales sobre el personal profesional: valor global para todo el contrato.
  prestacionesSocialesGLB: number;
  otrosCostosDirectosMensuales: ItemCostoMensual[];
  // NUNCA hardcodear: deben venir como parámetro de entrada por proceso (confirmado con el
  // cliente 2026-06-27 — la plantilla solo trae 3%/1% como ejemplo de un caso puntual).
  utilidadPct: number;
  imprevistosPct: number;
}

export interface ResultadoCotizacion {
  totalPersonal: number;
  totalPrestaciones: number;
  totalPerfeccionamiento: number;
  totalOtrosCostosDirectos: number;
  subtotalCostosDirectos: number;
  utilidad: number;
  imprevistos: number;
  costosDirectosMasUtilidadEImprevistos: number;
  iva: number;
  costoTotalCotizar: number;
}

export type Riesgo = "bajo" | "medio" | "alto";

export interface EvaluacionFrenteAPresupuesto {
  presupuestoOficial: number;
  costoTotalCotizar: number;
  // Política de la empresa: nunca descontar más del 18% sobre el presupuesto oficial.
  descuentoMaximoPct: number;
  valorMinimoPorPolitica: number;
  valorRecomendado: number;
  descuentoSobrePresupuestoPct: number;
  margenSobreCostoPct: number;
  riesgo: Riesgo;
  observacion: string;
}
