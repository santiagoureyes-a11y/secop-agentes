/**
 * leerYCalcular.ts
 *
 * Script standalone que:
 * 1. Descarga todos los documentos del proceso desde SECOP II
 * 2. Extrae el plazo de ejecución del pliego con pdfminer
 * 3. Calcula la cotización con la plantilla de personal según rango de presupuesto
 * 4. PATCHea /api/procesos/:dbId/recomendacion-financiera (lo que auto-manda el email)
 *
 * Variables de entorno requeridas:
 *   PROCESO_DBID, PROCESO_ID, PROCESO_URL, PROCESO_PRESUPUESTO
 *   VERDE_ECOLOGICO_USUARIO, VERDE_ECOLOGICO_PASSWORD (o via dashboard/.env)
 */

import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { iniciarSesion } from "./iniciarSesion.js";
import { listarDocumentos, descargarDocumento, carpetaDescargas } from "./descargarDocumentos.js";
import {
  extraerTextoPdf,
  extraerPlazo,
  extraerNumeroProceso,
  extraerPersonalMinimo,
  type RolPliego,
} from "./extraerPliego.js";
import { calcularCotizacion, evaluarFrenteAPresupuesto } from "../../financiero/src/calculadora.js";
import { mapearCargoASueldo } from "../../financiero/src/perfiles.js";
import type { InsumoCotizacion } from "../../financiero/src/types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
process.loadEnvFile?.(path.join(__dirname, "..", "..", "dashboard", "backend", ".env"));

const DASHBOARD_URL = process.env.DASHBOARD_URL ?? "https://secop-agentes-production.up.railway.app";
const NIT = "900520676-4";

const PROCESO_DBID = process.env.PROCESO_DBID ?? "";
const PROCESO_ID = process.env.PROCESO_ID ?? "";
const PROCESO_URL = process.env.PROCESO_URL ?? "";
const PROCESO_PRESUPUESTO = Number(process.env.PROCESO_PRESUPUESTO ?? "0");

if (!PROCESO_DBID || !PROCESO_ID || !PROCESO_URL || !PROCESO_PRESUPUESTO) {
  console.error("Faltan variables: PROCESO_DBID, PROCESO_ID, PROCESO_URL, PROCESO_PRESUPUESTO");
  process.exit(1);
}

// ── Costos indirectos mensuales ────────────────────────────────────────────
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
const OTROS_COSTOS_PEQUENO = [
  { item: "Transporte y comunicaciones", valorUnitarioMes: 110_000 },
  { item: "Papelería y equipos de oficina", valorUnitarioMes: 65_000 },
];

const PRESTACIONES_9M = 33_324_535;
const PERFECCIONAMIENTO_9M = 2_174_000;
const glb = (meses: number, base: number) => base * (meses / 9);

// ── Plantilla de personal según rango de presupuesto ──────────────────────
function plantillaPersonal(presupuesto: number, meses: number): InsumoCotizacion {
  if (presupuesto < 30_000_000) {
    return {
      duracionMeses: meses,
      personal: [
        { rol: "Director de interventoría", cantidad: 1, sueldoBasicoMes: 4_500_000, pctDedicacion: 0.25 },
        { rol: "Apoyo administrativo", cantidad: 1, sueldoBasicoMes: 2_500_000, pctDedicacion: 0.5 },
      ],
      prestacionesSocialesGLB: glb(meses, PRESTACIONES_9M) * 0.3,
      costosPerfeccionamientoGLB: glb(meses, PERFECCIONAMIENTO_9M) * 0.3,
      otrosCostosDirectosMensuales: OTROS_COSTOS_PEQUENO,
      utilidadPct: 0.03,
      imprevistosPct: 0.01,
    };
  }
  if (presupuesto < 60_000_000) {
    return {
      duracionMeses: meses,
      personal: [
        { rol: "Director de interventoría", cantidad: 1, sueldoBasicoMes: 5_000_000, pctDedicacion: 0.5 },
        { rol: "Interventor residente", cantidad: 1, sueldoBasicoMes: 4_000_000, pctDedicacion: 1 },
        { rol: "Profesional SST", cantidad: 1, sueldoBasicoMes: 3_300_000, pctDedicacion: 0.25 },
      ],
      prestacionesSocialesGLB: glb(meses, PRESTACIONES_9M) * 0.5,
      costosPerfeccionamientoGLB: glb(meses, PERFECCIONAMIENTO_9M) * 0.5,
      otrosCostosDirectosMensuales: OTROS_COSTOS_STD,
      utilidadPct: 0.03,
      imprevistosPct: 0.01,
    };
  }
  if (presupuesto < 120_000_000) {
    return {
      duracionMeses: meses,
      personal: [
        { rol: "Director de interventoría", cantidad: 1, sueldoBasicoMes: 6_000_000, pctDedicacion: 0.5 },
        { rol: "Interventor residente", cantidad: 1, sueldoBasicoMes: 4_500_000, pctDedicacion: 1 },
        { rol: "Especialista técnico", cantidad: 1, sueldoBasicoMes: 4_000_000, pctDedicacion: 0.5 },
        { rol: "Profesional SST", cantidad: 1, sueldoBasicoMes: 3_300_000, pctDedicacion: 0.25 },
      ],
      prestacionesSocialesGLB: glb(meses, PRESTACIONES_9M) * 0.7,
      costosPerfeccionamientoGLB: glb(meses, PERFECCIONAMIENTO_9M) * 0.7,
      otrosCostosDirectosMensuales: OTROS_COSTOS_STD,
      utilidadPct: 0.03,
      imprevistosPct: 0.01,
    };
  }
  return {
    duracionMeses: meses,
    personal: [
      { rol: "Director de interventoría", cantidad: 1, sueldoBasicoMes: 7_000_000, pctDedicacion: 0.5 },
      { rol: "Interventor residente", cantidad: 1, sueldoBasicoMes: 5_000_000, pctDedicacion: 1 },
      { rol: "Especialista técnico 1", cantidad: 1, sueldoBasicoMes: 4_500_000, pctDedicacion: 0.5 },
      { rol: "Especialista técnico 2", cantidad: 1, sueldoBasicoMes: 4_500_000, pctDedicacion: 0.5 },
      { rol: "Profesional SST", cantidad: 1, sueldoBasicoMes: 3_500_000, pctDedicacion: 0.5 },
    ],
    prestacionesSocialesGLB: glb(meses, PRESTACIONES_9M),
    costosPerfeccionamientoGLB: glb(meses, PERFECCIONAMIENTO_9M),
    otrosCostosDirectosMensuales: OTROS_COSTOS_STD,
    utilidadPct: 0.03,
    imprevistosPct: 0.01,
  };
}

// ── Main ───────────────────────────────────────────────────────────────────
(async () => {
  console.log(`\n=== Leer + Calcular: ${PROCESO_ID} ===`);
  console.log(`Presupuesto: $${PROCESO_PRESUPUESTO.toLocaleString("es-CO")}`);

  // 1. Descargar documentos del proceso
  const contexto = await iniciarSesion({ nombreEnv: "VERDE_ECOLOGICO", nit: NIT });
  const page = contexto.pages()[0] ?? (await contexto.newPage());

  console.log("\n[1/4] Descargando documentos del pliego...");
  await page.goto(PROCESO_URL, { waitUntil: "domcontentloaded", timeout: 45_000 });
  await page.waitForSelector("#grdGridDocumentList_tbl", { timeout: 30_000 }).catch(() => {
    console.warn("  Tabla de documentos no apareció — continuando");
  });

  const docs = await listarDocumentos(page);
  console.log(`  ${docs.length} documentos encontrados`);

  const carpeta = carpetaDescargas(NIT, PROCESO_ID);

  for (const doc of docs) {
    try {
      await descargarDocumento(page, doc, NIT, PROCESO_ID);
      console.log(`  ↓ ${doc.nombre}`);
    } catch (err) {
      console.warn(`  ⚠ ${doc.nombre}: ${(err as Error).message.slice(0, 80)}`);
    }
  }

  await contexto.close();

  // Algunos pliegos empaquetan los formatos en .zip — extraerlos aplanados para que
  // el documental los encuentre (se omiten los metadatos de macOS del empaquetador).
  for (const zip of fs.readdirSync(carpeta).filter((f) => f.toLowerCase().endsWith(".zip"))) {
    try {
      execSync(
        `unzip -o -j "${path.join(carpeta, zip)}" -x "__MACOSX/*" "*.DS_Store" -d "${carpeta}"`,
        { timeout: 30_000 }
      );
      console.log(`  ⤷ Descomprimido: ${zip}`);
    } catch (err) {
      console.warn(`  ⚠ No se pudo descomprimir ${zip}: ${(err as Error).message.slice(0, 80)}`);
    }
  }

  const rutasPdf = fs
    .readdirSync(carpeta)
    .filter((f) => f.toLowerCase().endsWith(".pdf"))
    .map((f) => path.join(carpeta, f));

  // 2. Extraer datos del pliego (plazo, número del proceso) — nunca se asumen
  console.log("\n[2/4] Extrayendo datos del pliego...");
  const plazoManual = Number(process.env.PLAZO_MESES ?? 0);
  let duracionMeses = 0;
  let fuentePlazo = "";
  let evidenciaPlazo = "";
  let numeroProceso: string | null = null;
  let fuenteNumero = "";
  let personalPliego: { roles: RolPliego[]; textoSeccion: string } | null = null;
  let fuentePersonal = "";

  if (plazoManual > 0) {
    duracionMeses = plazoManual;
    fuentePlazo = "override manual via PLAZO_MESES";
  }

  if (rutasPdf.length === 0 && !duracionMeses) {
    console.error("  ✗ No se descargó ningún PDF del pliego — se aborta para no cotizar con un plazo inventado.");
    console.error("    Reintenta, o corre manualmente con PLAZO_MESES=<n> si el plazo se conoce por otra vía.");
    process.exit(1);
  }

  for (const pdf of rutasPdf) {
    const texto = extraerTextoPdf(pdf);
    if (!texto) continue;

    if (!duracionMeses) {
      const plazo = extraerPlazo(texto);
      if (plazo && plazo.meses > 0 && plazo.meses <= 36) {
        duracionMeses = plazo.meses;
        fuentePlazo = `extraído de ${path.basename(pdf)}`;
        evidenciaPlazo = plazo.evidencia;
      }
    }
    if (!numeroProceso) {
      const numero = extraerNumeroProceso(texto);
      if (numero) {
        numeroProceso = numero.numero;
        fuenteNumero = `${path.basename(pdf)}: "${numero.evidencia}"`;
      }
    }
    if (!personalPliego?.roles.length) {
      const personal = extraerPersonalMinimo(texto);
      if (personal) {
        personalPliego = personal;
        fuentePersonal = path.basename(pdf);
      }
    }
    if (duracionMeses && numeroProceso && personalPliego?.roles.length) break;
  }

  if (!duracionMeses) {
    console.error("  ✗ No se encontró el plazo de ejecución en ningún PDF del pliego — se aborta para no cotizar con un plazo inventado.");
    console.error(`    PDFs revisados en ${carpeta}. Corre manualmente con PLAZO_MESES=<n> tras leer el pliego.`);
    process.exit(1);
  }
  console.log(`  Plazo: ${duracionMeses} meses (${fuentePlazo})`);
  if (evidenciaPlazo) console.log(`    Evidencia: "${evidenciaPlazo}"`);
  console.log(
    numeroProceso
      ? `  Número del proceso: ${numeroProceso} (${fuenteNumero})`
      : "  ⚠ Número interno del proceso no encontrado — el documental lo pedirá manualmente"
  );

  // Personal mínimo del pliego → costear con ESE equipo, no con la plantilla genérica.
  // Cargos sin mapear a la tabla de sueldos o dedicaciones ilegibles se costean con
  // supuestos conservadores (fallback / 100%) y fuerzan riesgo alto para revisión humana.
  const advertenciasPersonal: string[] = [];
  let personalCosteo: InsumoCotizacion["personal"] | null = null;

  if (personalPliego && personalPliego.roles.length > 0) {
    console.log(`  Personal mínimo del pliego (${fuentePersonal}):`);
    personalCosteo = personalPliego.roles.map((rol) => {
      const sueldo = mapearCargoASueldo(rol.cargo);
      if (!sueldo.mapeado) {
        advertenciasPersonal.push(`cargo sin mapear a sueldo: "${rol.cargo}" (se usó fallback)`);
      }
      if (rol.dedicacionPct === null) {
        advertenciasPersonal.push(`dedicación ilegible para "${rol.cargo}" (se costeó al 100%)`);
      }
      console.log(
        `    - ${rol.cantidad}× ${rol.cargo} → ${sueldo.perfil} $${sueldo.sueldoBasicoMes.toLocaleString("es-CO")}/mes × ${rol.dedicacionPct ?? 100}%`
      );
      return {
        rol: rol.cargo,
        cantidad: rol.cantidad,
        sueldoBasicoMes: sueldo.sueldoBasicoMes,
        pctDedicacion: (rol.dedicacionPct ?? 100) / 100,
      };
    });
    advertenciasPersonal.forEach((a) => console.log(`    ⚠ ${a}`));
  } else if (personalPliego) {
    advertenciasPersonal.push(
      "sección de personal mínimo detectada pero no se pudo interpretar la tabla — revisar el pliego a mano"
    );
    console.log(`  ⚠ ${advertenciasPersonal[advertenciasPersonal.length - 1]}`);
  } else {
    advertenciasPersonal.push(
      "el pliego no declara personal mínimo detectable — se costeó con la plantilla interna"
    );
    console.log(`  ⚠ ${advertenciasPersonal[advertenciasPersonal.length - 1]}`);
  }

  // Fuente de verdad por-proceso para los agentes siguientes (documental, suscripción):
  // todo dato extraído del pliego queda aquí con su evidencia, nada se asume aguas abajo.
  const datosPliego = {
    idProceso: PROCESO_ID,
    plazoMeses: duracionMeses,
    fuentePlazo,
    evidenciaPlazo: evidenciaPlazo || null,
    numeroProceso,
    fuenteNumeroProceso: fuenteNumero || null,
    personalMinimo: personalPliego
      ? { fuente: fuentePersonal, roles: personalPliego.roles, textoSeccion: personalPliego.textoSeccion.slice(0, 1200) }
      : null,
    advertenciasPersonal,
    extraidoEl: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(carpeta, "datos-pliego.json"), JSON.stringify(datosPliego, null, 2));
  console.log(`  → datos-pliego.json guardado en ${carpeta}`);

  // 3. Calcular cotización
  console.log("\n[3/4] Calculando cotización...");
  const insumoPlantilla = plantillaPersonal(PROCESO_PRESUPUESTO, duracionMeses);
  const insumo: InsumoCotizacion = personalCosteo
    ? { ...insumoPlantilla, personal: personalCosteo }
    : insumoPlantilla;
  const resultado = calcularCotizacion(insumo);
  const evaluacion = evaluarFrenteAPresupuesto(resultado.costoTotalCotizar, PROCESO_PRESUPUESTO);

  // Todo supuesto no verificable contra el pliego degrada la confianza de la cotización.
  if (advertenciasPersonal.length > 0 && evaluacion.riesgo === "bajo") {
    evaluacion.riesgo = "medio";
  }
  if (personalCosteo && advertenciasPersonal.length > 0) {
    evaluacion.riesgo = "alto";
  }

  if (personalCosteo) {
    const costoPlantilla = calcularCotizacion(insumoPlantilla).costoTotalCotizar;
    console.log(
      `  (Comparación: plantilla interna habría dado $${Math.round(costoPlantilla).toLocaleString("es-CO")} — se usó el equipo del pliego)`
    );
  }

  console.log(`  Costo calculado:   $${resultado.costoTotalCotizar.toLocaleString("es-CO")}`);
  console.log(`  Valor a ofertar:   $${evaluacion.valorRecomendado.toLocaleString("es-CO")}`);
  console.log(`  Descuento:         ${(evaluacion.descuentoSobrePresupuestoPct * 100).toFixed(1)}%`);
  console.log(`  Margen:            ${(evaluacion.margenSobreCostoPct * 100).toFixed(1)}%`);
  console.log(`  Riesgo:            ${evaluacion.riesgo.toUpperCase()}`);
  console.log(`  Equipo:`);
  insumo.personal.forEach((p) =>
    console.log(`    - ${p.rol}: $${p.sueldoBasicoMes.toLocaleString("es-CO")} × ${p.pctDedicacion * 100}% × ${duracionMeses}m`)
  );

  // 4. PATCH dashboard → auto-cambia estado a "cotizado" y manda email al gerente
  console.log("\n[4/4] Actualizando dashboard...");
  const body = {
    valorSugerido: Math.round(evaluacion.valorRecomendado),
    margenEsperado: Math.round(evaluacion.margenSobreCostoPct * 10000) / 10000,
    riesgo: evaluacion.riesgo,
  };

  const res = await fetch(`${DASHBOARD_URL}/api/procesos/${PROCESO_DBID}/recomendacion-financiera`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (res.ok) {
    console.log("  ✅ Dashboard actualizado — email enviado al gerente");
    console.log(`  Plazo usado: ${duracionMeses} meses (${fuentePlazo})`);
  } else {
    const texto = await res.text();
    console.error(`  ✗ Error PATCH: ${res.status} ${texto}`);
    process.exit(1);
  }

  process.exit(0);
})();
