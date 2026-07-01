import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Empresas de ejemplo — reemplazar por las razones sociales reales y sus NITs cuando
// el usuario los comparta. Las credenciales de SECOP de cada una NUNCA van aquí.
const empresas = [
  { nombre: "Verde Ecológico SAS", nit: "900000001-1" },
  { nombre: "Verde Ecológico II SAS", nit: "900000002-2" },
];

// Procesos de ejemplo basados en resultados reales del Agente Scout con el perfil de
// interventoría de mínima cuantía (ver scout/src/index.ts) — sirven para probar el
// dashboard mientras se calibra el Agente Financiero con el formato económico real.
const procesos = [
  {
    idProceso: "CO1.REQ.10545236",
    entidad: "ALCALDIA DE LA APARTADA CORDOBA",
    objeto: "INTERVENTORÍA TÉCNICA, ADMINISTRATIVA Y CONTABLE — MÍNIMA CUANTÍA",
    valorBase: 45_000_000,
    modalidad: "Mínima cuantía",
    fechaCierre: new Date("2026-07-02"),
    estado: "por_revisar",
    empresaNit: "900000001-1",
  },
  {
    idProceso: "CO1.REQ.10515128",
    entidad: "ALCALDIA DISTRITO DE RIOHACHA",
    objeto:
      "INTERVENTORIA TECNICA, ADMINISTRATIVA, FINANCIERA, CONTABLE Y JURIDICA PARA EL CONTRATO DE OBRA PUBLICA DE REDES ELÉCTRICAS DE MEDIA Y BAJA TENSIÓN",
    valorBase: 180_000_000,
    modalidad: "Mínima cuantía",
    fechaCierre: new Date("2026-07-05"),
    estado: "cotizado",
    valorSugerido: 147_600_000, // 18% de descuento sobre el presupuesto oficial
    margenEsperado: 0.25,
    riesgo: "Bajo",
    empresaNit: "900000001-1",
  },
  {
    idProceso: "CO1.REQ.10486877",
    entidad: "MUNICIPIO DE YOPAL",
    objeto:
      "INTERVENTORIA TECNICA, ADMINISTRATIVA, FINANCIERA, CONTABLE, AMBIENTAL Y JURIDICA AL CONTRATO DE OBRA — DEMOLICION MECANICA",
    valorBase: 92_000_000,
    modalidad: "Mínima cuantía",
    fechaCierre: new Date("2026-07-08"),
    estado: "aprobado_radicar",
    valorSugerido: 75_440_000,
    margenEsperado: 0.25,
    riesgo: "Medio",
    empresaNit: "900000002-2",
  },
  {
    idProceso: "CO1.REQ.343288",
    entidad: "INSTITUTO NACIONAL PENITENCIARIO Y CARCELARIO INPEC",
    objeto: "INTERVENTORÍA TÉCNICA, ADMINISTRATIVA Y CONTABLE — DESCARTADO POR PLAZO",
    valorBase: 12_000_000,
    modalidad: "Mínima cuantía",
    estado: "rechazado",
    empresaNit: "900000001-1",
  },
];

for (const empresa of empresas) {
  await prisma.empresa.upsert({ where: { nit: empresa.nit }, update: empresa, create: empresa });
}

for (const { empresaNit, ...proceso } of procesos) {
  const empresa = await prisma.empresa.findUnique({ where: { nit: empresaNit } });
  await prisma.proceso.upsert({
    where: { idProceso: proceso.idProceso },
    update: { ...proceso, empresaId: empresa?.id },
    create: { ...proceso, empresaId: empresa?.id },
  });
}

console.log(`Sembradas ${empresas.length} empresas y ${procesos.length} procesos de ejemplo.`);
await prisma.$disconnect();
