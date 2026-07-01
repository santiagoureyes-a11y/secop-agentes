import type { EvaluacionFrenteAPresupuesto, InsumoCotizacion, ResultadoCotizacion } from "./types.js";

const IVA_PCT = 0.19;

// Replica la metodología real de Verde Ecológico (ver docs/empresa/formula-cotizacion-interventoria.md):
// personal profesional + prestaciones + perfeccionamiento + otros costos directos = subtotal,
// + utilidad% + imprevistos% (parámetros por proceso) = base con margen, + IVA 19% = costo total a cotizar.
export function calcularCotizacion(insumo: InsumoCotizacion): ResultadoCotizacion {
  const totalPersonal = insumo.personal.reduce(
    (acc, p) => acc + p.cantidad * p.sueldoBasicoMes * p.pctDedicacion * insumo.duracionMeses,
    0
  );

  const totalPrestaciones = insumo.prestacionesSocialesGLB;
  const totalPerfeccionamiento = insumo.costosPerfeccionamientoGLB;

  const totalOtrosCostosDirectos = insumo.otrosCostosDirectosMensuales.reduce(
    (acc, c) => acc + c.valorUnitarioMes * insumo.duracionMeses,
    0
  );

  const subtotalCostosDirectos =
    totalPersonal + totalPrestaciones + totalPerfeccionamiento + totalOtrosCostosDirectos;

  const utilidad = subtotalCostosDirectos * insumo.utilidadPct;
  const imprevistos = subtotalCostosDirectos * insumo.imprevistosPct;
  const costosDirectosMasUtilidadEImprevistos = subtotalCostosDirectos + utilidad + imprevistos;
  const iva = costosDirectosMasUtilidadEImprevistos * IVA_PCT;
  const costoTotalCotizar = costosDirectosMasUtilidadEImprevistos + iva;

  return {
    totalPersonal,
    totalPrestaciones,
    totalPerfeccionamiento,
    totalOtrosCostosDirectos,
    subtotalCostosDirectos,
    utilidad,
    imprevistos,
    costosDirectosMasUtilidadEImprevistos,
    iva,
    costoTotalCotizar,
  };
}

// Evalúa el costo calculado frente al presupuesto oficial del proceso, aplicando la regla de
// negocio confirmada: nunca descontar más del 18% sobre el presupuesto oficial. En mínima
// cuantía se adjudica al menor valor, así que conviene ofertar lo más bajo posible sin caer
// por debajo del costo real ni de ese límite de política.
export function evaluarFrenteAPresupuesto(
  costoTotalCotizar: number,
  presupuestoOficial: number,
  descuentoMaximoPct = 0.18
): EvaluacionFrenteAPresupuesto {
  const valorMinimoPorPolitica = presupuestoOficial * (1 - descuentoMaximoPct);
  const valorRecomendado = Math.min(presupuestoOficial, Math.max(costoTotalCotizar, valorMinimoPorPolitica));
  const descuentoSobrePresupuestoPct = 1 - valorRecomendado / presupuestoOficial;
  const margenSobreCostoPct = costoTotalCotizar > 0 ? (valorRecomendado - costoTotalCotizar) / costoTotalCotizar : 0;

  let riesgo: "bajo" | "medio" | "alto" = "bajo";
  let observacion = "Costo cubierto y dentro del límite de descuento del 18%.";

  if (costoTotalCotizar > presupuestoOficial) {
    riesgo = "alto";
    observacion = "El costo real calculado supera el presupuesto oficial: no es rentable participar a este precio.";
  } else if (costoTotalCotizar > valorMinimoPorPolitica) {
    riesgo = "medio";
    observacion =
      "El costo real deja poco margen frente al límite de descuento del 18% — competitividad limitada.";
  }

  return {
    presupuestoOficial,
    costoTotalCotizar,
    descuentoMaximoPct,
    valorMinimoPorPolitica,
    valorRecomendado,
    descuentoSobrePresupuestoPct,
    margenSobreCostoPct,
    riesgo,
    observacion,
  };
}
