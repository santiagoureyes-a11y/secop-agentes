import { calcularCotizacion, evaluarFrenteAPresupuesto } from "./calculadora.js";
import type { InsumoCotizacion } from "./types.js";

// Ejemplo real de calibración (2026-06-27): proceso CO1.REQ.10532988 — "CONTRATAR LA
// INTERVENTORÍA TÉCNICA, ADMINISTRATIVA, FINANCIERA, AMBIENTAL, JURÍDICA Y CONTABLE AL
// MANTENIMIENTO A TODO COSTO DE LAS BATERÍAS SANITARIAS..." (CENAC INGENIEROS), encontrado
// por el Agente Scout. Presupuesto oficial: $59.524.000, duración: 75 días (2.5 meses).
const PRESUPUESTO_OFICIAL_PROCESO = 59_524_000;
const DURACION_MESES_PROCESO = 75 / 30;

// Roles y tarifas mensuales tomados de la plantilla real de Verde Ecológico
// (`FACTOR MULTIPLICADOR - Oferta Económica.csv`) — sueldo básico mensual es una tarifa fija,
// no escala con la duración del proceso.
const insumo: InsumoCotizacion = {
  duracionMeses: DURACION_MESES_PROCESO,
  personal: [
    { rol: "Director de interventoría", cantidad: 1, sueldoBasicoMes: 5_000_000, pctDedicacion: 0.5 },
    { rol: "Interventor residente junior", cantidad: 1, sueldoBasicoMes: 4_000_000, pctDedicacion: 1 },
    { rol: "Profesional SST", cantidad: 1, sueldoBasicoMes: 3_300_000, pctDedicacion: 0.5 },
  ],
  // La plantilla real solo trae estos valores como GLB fijo para un proceso de 9 meses.
  // Mientras no se tenga una cotización real de pólizas/prestaciones para este proceso
  // puntual, se escalan proporcionalmente a la duración como aproximación de calibración
  // — ajustar con cifras reales cuando el Agente Financiero se use en producción.
  prestacionesSocialesGLB: 33_324_535 * (DURACION_MESES_PROCESO / 9),
  costosPerfeccionamientoGLB: 2_174_000 * (DURACION_MESES_PROCESO / 9),
  otrosCostosDirectosMensuales: [
    { item: "C1. Arriendo oficina y servicios públicos", valorUnitarioMes: 955_555.56 },
    { item: "C2. Papelería y útiles de oficina", valorUnitarioMes: 111_111.11 },
    { item: "C3. Equipo y mantenimiento de oficina", valorUnitarioMes: 155_555.56 },
    { item: "C4. Dotación y EPP", valorUnitarioMes: 111_111.11 },
    { item: "C5. Transporte", valorUnitarioMes: 111_111.11 },
    { item: "C6. Asesoría legal y tributaria", valorUnitarioMes: 111_111.11 },
    { item: "C7. Asesoría ambiental", valorUnitarioMes: 100_000 },
    { item: "C8. Asesorías técnicas", valorUnitarioMes: 111_111.11 },
  ],
  // Parámetros por proceso (NUNCA hardcodear en el cálculo) — se usan los mismos valores de
  // ejemplo de la plantilla (3% / 1%) solo para este ejercicio de calibración.
  utilidadPct: 0.03,
  imprevistosPct: 0.01,
};

const resultado = calcularCotizacion(insumo);
const evaluacion = evaluarFrenteAPresupuesto(resultado.costoTotalCotizar, PRESUPUESTO_OFICIAL_PROCESO);

console.log("=== Agente Financiero — ejemplo de calibración ===");
console.log("Proceso: CO1.REQ.10532988 (CENAC INGENIEROS)");
console.log(`Presupuesto oficial: $${PRESUPUESTO_OFICIAL_PROCESO.toLocaleString("es-CO")}`);
console.log(`Duración: ${DURACION_MESES_PROCESO} meses\n`);

console.log("-- Estructura de costos --");
console.log(`Personal profesional:        $${resultado.totalPersonal.toLocaleString("es-CO")}`);
console.log(`Prestaciones sociales:       $${resultado.totalPrestaciones.toLocaleString("es-CO")}`);
console.log(`Costos de perfeccionamiento: $${resultado.totalPerfeccionamiento.toLocaleString("es-CO")}`);
console.log(`Otros costos directos:       $${resultado.totalOtrosCostosDirectos.toLocaleString("es-CO")}`);
console.log(`Subtotal costos directos:    $${resultado.subtotalCostosDirectos.toLocaleString("es-CO")}`);
console.log(`Utilidad (3%):                $${resultado.utilidad.toLocaleString("es-CO")}`);
console.log(`Imprevistos (1%):             $${resultado.imprevistos.toLocaleString("es-CO")}`);
console.log(`IVA (19%):                    $${resultado.iva.toLocaleString("es-CO")}`);
console.log(`COSTO TOTAL A COTIZAR:        $${resultado.costoTotalCotizar.toLocaleString("es-CO")}\n`);

console.log("-- Evaluación frente al presupuesto oficial --");
console.log(`Valor mínimo por política (máx. 18% descuento): $${evaluacion.valorMinimoPorPolitica.toLocaleString("es-CO")}`);
console.log(`Valor recomendado a ofertar:                     $${evaluacion.valorRecomendado.toLocaleString("es-CO")}`);
console.log(`Descuento sobre presupuesto:                     ${(evaluacion.descuentoSobrePresupuestoPct * 100).toFixed(1)}%`);
console.log(`Margen sobre costo:                              ${(evaluacion.margenSobreCostoPct * 100).toFixed(1)}%`);
console.log(`Riesgo: ${evaluacion.riesgo.toUpperCase()} — ${evaluacion.observacion}`);
