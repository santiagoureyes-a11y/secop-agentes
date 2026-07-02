import { leerManifiesto } from "./manifest.js";
import { generarDocumentosProceso } from "./generarDocumentos.js";

const NIT = "900520676-4";
const manifiesto = leerManifiesto(NIT);
const empresa = {
  nombre: manifiesto.empresa.nombre,
  nit: manifiesto.empresa.nit,
  representanteLegal: manifiesto.empresa.representanteLegal,
};

// Inline calculator — mismo algoritmo que financiero/src/calculadora.ts (no se importa entre paquetes).
const IVA_PCT = 0.19;

interface Insumo {
  duracionMeses: number;
  personal: { rol: string; cantidad: number; sueldo: number; dedicacion: number }[];
  prestaciones: number;
  perfeccionamiento: number;
  otrosMensuales: { item: string; valor: number }[];
  utilidadPct: number;
  imprevistosPct: number;
}

function calcular(i: Insumo) {
  const totalPersonal = i.personal.reduce(
    (acc, p) => acc + p.cantidad * p.sueldo * p.dedicacion * i.duracionMeses,
    0
  );
  const totalOtros = i.otrosMensuales.reduce((acc, c) => acc + c.valor * i.duracionMeses, 0);
  const subtotalCostosDirectos = totalPersonal + i.prestaciones + i.perfeccionamiento + totalOtros;
  const utilidad = subtotalCostosDirectos * i.utilidadPct;
  const imprevistos = subtotalCostosDirectos * i.imprevistosPct;
  const baseConMargen = subtotalCostosDirectos + utilidad + imprevistos;
  const iva = baseConMargen * IVA_PCT;
  const costoTotalCotizar = baseConMargen + iva;
  return { subtotalCostosDirectos, utilidad, imprevistos, iva, costoTotalCotizar };
}

function recomendado(costoTotal: number, presupuesto: number, descMaxPct = 0.18): number {
  const minPorPolitica = presupuesto * (1 - descMaxPct);
  return Math.round(Math.min(presupuesto, Math.max(costoTotal, minPorPolitica)));
}

const PRESTACIONES_9M = 33_324_535;
const PERFECCIONAMIENTO_9M = 2_174_000;
const glb = (meses: number, base: number) => base * (meses / 9);

const STD = [
  { item: "Arriendo oficina y servicios", valor: 955_555.56 },
  { item: "Papelería y útiles", valor: 111_111.11 },
  { item: "Equipo y mantenimiento", valor: 155_555.56 },
  { item: "Dotación y EPP", valor: 111_111.11 },
  { item: "Transporte", valor: 111_111.11 },
  { item: "Asesoría legal y tributaria", valor: 111_111.11 },
  { item: "Asesoría ambiental", valor: 100_000 },
  { item: "Asesorías técnicas", valor: 111_111.11 },
];

const PEQUEÑO = [
  { item: "Transporte y comunicaciones", valor: 110_000 },
  { item: "Papelería y equipos de oficina", valor: 65_000 },
];

interface ProcesoDef {
  idProceso: string;
  entidad: string;
  objeto: string;
  presupuesto: number;
  insumo: Insumo;
  nota?: string;
}

const procesos: ProcesoDef[] = [
  {
    idProceso: "CO1.REQ.10558278",
    entidad: "GOBERNACION DE CALDAS",
    objeto:
      "INTERVENTORÍA TÉCNICA; ADMINISTRATIVA; FINANCIERA; CONTABLE Y JURÍDICA A LA REHABILITACION Y PAVIMENTACION DE LA VÍA IRRA - BONAFONT EN EL MUNICIPIO DE RIOSUCIO DEPARTAMENTO DE CALDAS",
    presupuesto: 122_421_472,
    insumo: {
      duracionMeses: 2,
      personal: [
        { rol: "Director de interventoría", cantidad: 1, sueldo: 5_000_000, dedicacion: 0.5 },
        { rol: "Interventor residente", cantidad: 1, sueldo: 4_500_000, dedicacion: 1 },
        { rol: "Especialista vías", cantidad: 1, sueldo: 4_000_000, dedicacion: 0.5 },
        { rol: "Profesional SST", cantidad: 1, sueldo: 3_300_000, dedicacion: 0.5 },
      ],
      prestaciones: glb(2, PRESTACIONES_9M),
      perfeccionamiento: glb(2, PERFECCIONAMIENTO_9M),
      otrosMensuales: STD,
      utilidadPct: 0.03,
      imprevistosPct: 0.01,
    },
  },
  {
    idProceso: "CO1.REQ.10532988",
    entidad: "CENTRAL ADMINISTRATIVA ESPECIALIZADA INGENIEROS CENAC INGENIEROS",
    objeto:
      "CONTRATAR LA INTERVENTORÍA TÉCNICA; ADMINISTRATIVA; FINANCIERA; AMBIENTAL; JURÍDICA Y CONTABLE AL MANTENIMIENTO A TODO COSTO DE LAS BATERÍAS SANITARIAS DE LOS ALOJAMIENTOS DEL PERSONAL DE SOLDADOS",
    presupuesto: 59_524_000,
    insumo: {
      duracionMeses: 75 / 30,
      personal: [
        { rol: "Director de interventoría", cantidad: 1, sueldo: 5_000_000, dedicacion: 0.5 },
        { rol: "Interventor residente junior", cantidad: 1, sueldo: 4_000_000, dedicacion: 1 },
        { rol: "Profesional SST", cantidad: 1, sueldo: 3_300_000, dedicacion: 0.5 },
      ],
      prestaciones: glb(75 / 30, PRESTACIONES_9M),
      perfeccionamiento: glb(75 / 30, PERFECCIONAMIENTO_9M),
      otrosMensuales: STD,
      utilidadPct: 0.03,
      imprevistosPct: 0.01,
    },
  },
  {
    idProceso: "CO1.REQ.10542087",
    entidad: "FONDO ROTATORIO DE LA REGISTRADURIA",
    objeto:
      "Interventoría Registraduría Municipal de Sabanagrande (Atlántico) y Registraduría Municipal de Villanueva (Bolívar)",
    presupuesto: 43_981_368,
    insumo: {
      duracionMeses: 3,
      personal: [
        { rol: "Interventor de obra", cantidad: 1, sueldo: 2_500_000, dedicacion: 1 },
      ],
      // Factor prestacional 1.65 documentado en el estudio previo: 0.65 × salario × meses
      prestaciones: 0.65 * 2_500_000 * 3,
      perfeccionamiento: glb(3, PERFECCIONAMIENTO_9M),
      otrosMensuales: PEQUEÑO,
      utilidadPct: 0.03,
      imprevistosPct: 0.01,
    },
  },
  {
    idProceso: "CO1.REQ.10520403",
    entidad: "Instituto Municipal de Cultura y Turismo de Bucaramanga",
    objeto:
      "INTERVENTORÍA TÉCNICA; JURÍDICA Y ADMINISTRATIVA DE LA INTERVENCIÓN DE OBRAS DE PRIMEROS AUXILIOS; ORIENTADAS A GARANTIZAR LAS CONDICIONES DE SEGURIDAD Y ESTABILIDAD DEL BIEN INMUEBLE DE INTERÉS CULTURAL — COLISEO PERALTA",
    presupuesto: 14_050_516,
    nota: "⚠ GANANCIA ~$270K — el gerente decide si participa. Documentos generados de todas formas.",
    insumo: {
      duracionMeses: 2,
      personal: [
        { rol: "Director de interventoría", cantidad: 1, sueldo: 4_733_334, dedicacion: 0.25 },
        { rol: "Asesor jurídico", cantidad: 1, sueldo: 4_454_167, dedicacion: 0.12 },
        { rol: "Apoyo administrativo", cantidad: 1, sueldo: 2_540_667, dedicacion: 0.5 },
      ],
      prestaciones: glb(2, PRESTACIONES_9M) * 0.35,
      perfeccionamiento: glb(2, PERFECCIONAMIENTO_9M) * 0.35,
      otrosMensuales: PEQUEÑO,
      utilidadPct: 0.03,
      imprevistosPct: 0.01,
    },
  },
];

console.log("=== Agente Documental — generación de ofertas para 4 procesos ===\n");

for (const proc of procesos) {
  const fin = calcular(proc.insumo);
  const valorRec = recomendado(fin.costoTotalCotizar, proc.presupuesto);

  const { cartaPresentacion, ofertaEconomica } = generarDocumentosProceso(
    empresa,
    { idProceso: proc.idProceso, entidad: proc.entidad, objeto: proc.objeto, valorBase: proc.presupuesto },
    {
      subtotalCostosDirectos: fin.subtotalCostosDirectos,
      utilidad: fin.utilidad,
      imprevistos: fin.imprevistos,
      iva: fin.iva,
      costoTotalCotizar: fin.costoTotalCotizar,
      valorRecomendado: valorRec,
    }
  );

  const ganancia = valorRec - fin.costoTotalCotizar;
  const gananciaStr = ganancia.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

  console.log(`✅ ${proc.idProceso} — ganancia ${gananciaStr}`);
  if (proc.nota) console.log(`   ${proc.nota}`);
  console.log(`   Carta:  ${cartaPresentacion}`);
  console.log(`   Oferta: ${ofertaEconomica}`);
  console.log();
}
