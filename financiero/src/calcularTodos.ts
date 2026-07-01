import { calcularCotizacion, evaluarFrenteAPresupuesto } from "./calculadora.js";
import type { InsumoCotizacion } from "./types.js";

const DASHBOARD_URL =
  process.env.DASHBOARD_URL ?? "https://secop-agentes-production.up.railway.app";

// Costos indirectos mensuales estándar (plantilla Verde Ecológico).
const OTROS_COSTOS_STD = [
  { item: "Arriendo oficina y servicios", valorUnitarioMes: 955_555.56 },
  { item: "Papelería y útiles", valorUnitarioMes: 111_111.11 },
  { item: "Equipo y mantenimiento", valorUnitarioMes: 155_555.56 },
  { item: "Dotación y EPP", valorUnitarioMes: 111_111.11 },
  { item: "Transporte", valorUnitarioMes: 111_111.11 },
  { item: "Asesoría legal y tributaria", valorUnitarioMes: 111_111.11 },
  { item: "Asesoría ambiental", valorUnitarioMes: 100_000 },
  { item: "Asesorías técnicas", valorUnitarioMes: 111_111.11 },
];

// Costos reducidos para proyectos pequeños (<$20M).
const OTROS_COSTOS_PEQUENO = [
  { item: "Transporte y comunicaciones", valorUnitarioMes: 110_000 },
  { item: "Papelería y equipos de oficina", valorUnitarioMes: 65_000 },
];

// Escalar GLB de prestaciones y perfeccionamiento (calibrados para 9 meses en plantilla VE).
const PRESTACIONES_9M = 33_324_535;
const PERFECCIONAMIENTO_9M = 2_174_000;
function glb(meses: number, base9m: number) {
  return base9m * (meses / 9);
}

interface ProcesoFinanciero {
  dbId: string;
  idProceso: string;
  presupuesto: number;
  insumo: InsumoCotizacion;
}

const procesos: ProcesoFinanciero[] = [
  {
    // CO1.REQ.10558278 — Gobernación de Caldas, Vía Irra-Bonafont, 2 meses
    dbId: "cmr1dldra0002cee320sjrnka",
    idProceso: "CO1.REQ.10558278",
    presupuesto: 122_421_472,
    insumo: {
      duracionMeses: 2,
      personal: [
        { rol: "Director de interventoría", cantidad: 1, sueldoBasicoMes: 5_000_000, pctDedicacion: 0.5 },
        { rol: "Interventor residente", cantidad: 1, sueldoBasicoMes: 4_500_000, pctDedicacion: 1 },
        { rol: "Especialista vías", cantidad: 1, sueldoBasicoMes: 4_000_000, pctDedicacion: 0.5 },
        { rol: "Profesional SST", cantidad: 1, sueldoBasicoMes: 3_300_000, pctDedicacion: 0.5 },
      ],
      prestacionesSocialesGLB: glb(2, PRESTACIONES_9M),
      costosPerfeccionamientoGLB: glb(2, PERFECCIONAMIENTO_9M),
      otrosCostosDirectosMensuales: OTROS_COSTOS_STD,
      utilidadPct: 0.03,
      imprevistosPct: 0.01,
    },
  },
  {
    // CO1.REQ.10532988 — CENAC INGENIEROS, Baterías sanitarias, 75 días
    dbId: "cmr1dleez000acee3f79hejcb",
    idProceso: "CO1.REQ.10532988",
    presupuesto: 59_524_000,
    insumo: {
      duracionMeses: 75 / 30,
      personal: [
        { rol: "Director de interventoría", cantidad: 1, sueldoBasicoMes: 5_000_000, pctDedicacion: 0.5 },
        { rol: "Interventor residente junior", cantidad: 1, sueldoBasicoMes: 4_000_000, pctDedicacion: 1 },
        { rol: "Profesional SST", cantidad: 1, sueldoBasicoMes: 3_300_000, pctDedicacion: 0.5 },
      ],
      prestacionesSocialesGLB: glb(75 / 30, PRESTACIONES_9M),
      costosPerfeccionamientoGLB: glb(75 / 30, PERFECCIONAMIENTO_9M),
      otrosCostosDirectosMensuales: OTROS_COSTOS_STD,
      utilidadPct: 0.03,
      imprevistosPct: 0.01,
    },
  },
  {
    // CO1.REQ.10520403 — Instituto Cultural Bucaramanga, Coliseo Peralta, 2 meses
    dbId: "cmr1dle5i0006cee3kfs9rdw3",
    idProceso: "CO1.REQ.10520403",
    presupuesto: 14_050_516,
    insumo: {
      duracionMeses: 2,
      personal: [
        { rol: "Director de interventoría", cantidad: 1, sueldoBasicoMes: 4_733_334, pctDedicacion: 0.25 },
        { rol: "Asesor jurídico", cantidad: 1, sueldoBasicoMes: 4_454_167, pctDedicacion: 0.12 },
        { rol: "Apoyo administrativo", cantidad: 1, sueldoBasicoMes: 2_540_667, pctDedicacion: 0.5 },
      ],
      prestacionesSocialesGLB: glb(2, PRESTACIONES_9M) * 0.35,
      costosPerfeccionamientoGLB: glb(2, PERFECCIONAMIENTO_9M) * 0.35,
      otrosCostosDirectosMensuales: OTROS_COSTOS_PEQUENO,
      utilidadPct: 0.03,
      imprevistosPct: 0.01,
    },
  },
  {
    // CO1.REQ.10542087 — Fondo Rotatorio Registraduría, Sabanagrande-Villanueva, 3 meses
    dbId: "cmr1dle0n0004cee36e6av916",
    idProceso: "CO1.REQ.10542087",
    presupuesto: 43_981_368,
    insumo: {
      duracionMeses: 3,
      personal: [
        { rol: "Interventor de obra", cantidad: 1, sueldoBasicoMes: 2_500_000, pctDedicacion: 1 },
      ],
      // Factor prestacional 1.65 documentado en el estudio previo de este proceso.
      // Prestaciones = 0.65 × salario total = 0.65 × 2,500,000 × 3
      prestacionesSocialesGLB: 0.65 * 2_500_000 * 3,
      costosPerfeccionamientoGLB: glb(3, PERFECCIONAMIENTO_9M),
      otrosCostosDirectosMensuales: OTROS_COSTOS_PEQUENO,
      utilidadPct: 0.03,
      imprevistosPct: 0.01,
    },
  },
];

async function actualizarDashboard(
  dbId: string,
  valorSugerido: number,
  margenEsperado: number,
  riesgo: string
) {
  const res = await fetch(`${DASHBOARD_URL}/api/procesos/${dbId}/recomendacion-financiera`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ valorSugerido, margenEsperado, riesgo }),
  });
  if (!res.ok) throw new Error(`PATCH falló: ${res.status} ${await res.text()}`);
}

console.log("=== Agente Financiero — cálculo real para 4 procesos ===\n");

for (const proc of procesos) {
  const resultado = calcularCotizacion(proc.insumo);
  const evaluacion = evaluarFrenteAPresupuesto(resultado.costoTotalCotizar, proc.presupuesto);

  console.log(`--- ${proc.idProceso} ---`);
  console.log(`Presupuesto oficial:   $${proc.presupuesto.toLocaleString("es-CO")}`);
  console.log(`Costo calculado:       $${resultado.costoTotalCotizar.toLocaleString("es-CO")}`);
  console.log(`Valor a ofertar:       $${evaluacion.valorRecomendado.toLocaleString("es-CO")}`);
  console.log(`Descuento:             ${(evaluacion.descuentoSobrePresupuestoPct * 100).toFixed(1)}%`);
  console.log(`Margen sobre costo:    ${(evaluacion.margenSobreCostoPct * 100).toFixed(1)}%`);
  console.log(`Riesgo: ${evaluacion.riesgo.toUpperCase()} — ${evaluacion.observacion}`);

  try {
    await actualizarDashboard(
      proc.dbId,
      Math.round(evaluacion.valorRecomendado),
      Math.round(evaluacion.margenSobreCostoPct * 10000) / 100,
      evaluacion.riesgo
    );
    console.log(`✅ Dashboard actualizado`);
  } catch (err) {
    console.warn(`⚠ No se pudo actualizar el dashboard: ${(err as Error).message}`);
  }
  console.log();
}
