/**
 * Diligencia las plantillas oficiales (.docx) descargadas de un proceso con los datos
 * reales de la empresa (manifest.json) y la firma manuscrita escaneada.
 *
 * El reemplazo dentro de los .docx lo hace src/diligenciar.py (python-docx, ya instalado
 * en el sistema): ver ahí la justificación técnica de las dos pasadas.
 *
 * Uso:
 *   npx tsx src/diligenciarPlantillas.ts <idProceso> [numeroProceso] [entidad] [ciudad] [direccionEntidad]
 *
 * Solo <idProceso> es obligatorio: el número interno sale de datos-pliego.json (lo escribe
 * leerYCalcular al leer el pliego) y entidad/ciudad salen de Datos Abiertos. Los argumentos
 * posicionales solo son overrides manuales. Si un dato no se puede obtener de su fuente,
 * el script aborta — nunca se inventa información del proceso.
 *
 * Los placeholders que exigen una DECISIÓN humana (revisor fiscal, tamaño de empresa,
 * información reservada, datos de contacto de la entidad) se dejan sin tocar y se
 * reportan al final — nunca se inventa una respuesta legal.
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { carpetaEmpresa, leerManifiesto } from "./manifest.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const NIT = "900520676-4";

const [idProceso, numeroProcesoArg, entidadArg, ciudadArg, direccionEntidad] = process.argv.slice(2);
if (!idProceso) {
  console.error(
    "Uso: npx tsx src/diligenciarPlantillas.ts <idProceso> [numeroProceso] [entidad] [ciudad] [direccionEntidad]"
  );
  process.exit(1);
}

// ── Datos del proceso: pliego (datos-pliego.json) y Datos Abiertos — nada asumido ──

interface DatosPliego {
  numeroProceso: string | null;
  plazoMeses: number;
  fuenteNumeroProceso: string | null;
}

function leerDatosPliego(nit: string, id: string): DatosPliego | null {
  const ruta = path.join(carpetaEmpresa(nit), "descargados", id, "datos-pliego.json");
  if (!fs.existsSync(ruta)) return null;
  return JSON.parse(fs.readFileSync(ruta, "utf-8")) as DatosPliego;
}

async function datosAbiertos(
  id: string
): Promise<{ entidad: string; ciudad: string; objeto: string } | null> {
  const url =
    "https://www.datos.gov.co/resource/p6dx-8zbt.json?" +
    new URLSearchParams({ $where: `id_del_proceso = '${id.replace(/'/g, "''")}'`, $limit: "1" });
  const res = await fetch(url);
  if (!res.ok) return null;
  const [p] = (await res.json()) as Array<{
    entidad?: string;
    ciudad_entidad?: string;
    nombre_del_procedimiento?: string;
    descripci_n_del_procedimiento?: string;
  }>;
  if (!p) return null;
  return {
    entidad: p.entidad ?? "",
    ciudad: p.ciudad_entidad ?? "",
    objeto: p.nombre_del_procedimiento ?? p.descripci_n_del_procedimiento ?? "",
  };
}

const datosPliego = leerDatosPliego(NIT, idProceso);
const numeroProceso = numeroProcesoArg || datosPliego?.numeroProceso || null;
if (!numeroProceso) {
  console.error(
    "✗ No hay número interno del proceso: ni por argumento ni en datos-pliego.json (lo genera leerYCalcular al leer el pliego)."
  );
  console.error("  Pásalo manualmente: npx tsx src/diligenciarPlantillas.ts " + idProceso + " <numeroProceso>");
  process.exit(1);
}
if (datosPliego?.fuenteNumeroProceso && !numeroProcesoArg) {
  console.log(`Número del proceso desde el pliego → ${datosPliego.fuenteNumeroProceso}`);
}

let entidad = entidadArg ?? "";
let ciudad = ciudadArg ?? "";
let objetoProceso = "";
if (!entidad || !ciudad) {
  const da = await datosAbiertos(idProceso);
  entidad = entidad || da?.entidad || "";
  ciudad = ciudad || da?.ciudad || "";
  objetoProceso = da?.objeto || "";
}
if (!entidad || !ciudad) {
  console.error("✗ No se pudo obtener entidad/ciudad de Datos Abiertos — pásalos como argumentos 3 y 4.");
  process.exit(1);
}

const manifiesto = leerManifiesto(NIT);
const e = manifiesto.empresa;
const rutaFirma = manifiesto.documentos["firmaManuscritaEscaneada"]?.archivo
  ? path.join(carpetaEmpresa(NIT), manifiesto.documentos["firmaManuscritaEscaneada"].archivo!)
  : null;

const hoy = new Date().toLocaleDateString("es-CO", {
  timeZone: "America/Bogota",
  day: "numeric",
  month: "long",
  year: "numeric",
});

function fechaLarga(iso: string): string {
  const [anio, mes, dia] = iso.split("-").map(Number);
  return new Date(Date.UTC(anio, mes - 1, dia, 12)).toLocaleDateString("es-CO", {
    timeZone: "UTC",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// ── Mapas de reemplazo ─────────────────────────────────────────────────────

const comunes: Record<string, string> = {
  "[NOMBRE DE LA ENTIDAD]": entidad,
  "[Incluir el nombre de la Entidad Estatal]": entidad,
  "[Incluir el nombre de la Entidad]": entidad,
  "[Incluir nombre de la Entidad]": entidad,
  "[Ciudad]": ciudad,
  "[Incluir número del proceso de contratación]": numeroProceso,
  "[Incluir número del Proceso de Contratación]": numeroProceso,
  // Proceso de mínima cuantía sin lotes — estas instrucciones no aplican:
  "[Incluir cuando el proceso es estructurado por lotes o grupos]": "",
  "[Incluir cuando el proceso sea estructurado por lotes o grupos]": "",
  "[Indicar el lote o lotes a los cuales se presenta oferta.]": "",
  "[Incluir el siguiente cuadro para los proponentes plurales]": "",
};
if (direccionEntidad) {
  comunes["[Dirección de la entidad]"] = direccionEntidad;
  comunes["[Dirección de la Entidad]"] = direccionEntidad;
}

const identidad: Record<string, string> = {
  "[Nombre del proponente- persona jurídica]": e.nombre,
  "[Nombre del proponente- persona natural]": "N/A",
  "[Nombre del representante legal del proponente]": e.representanteLegal ?? "",
  "[Incluir la Razón social de la persona jurídica]": e.nombre,
  "[Incluir la razón social de la persona jurídica]": e.nombre,
  "[Indicar el nombre de la persona jurídica o persona natural]": e.nombre,
  "[Indicar nombre del proponente, o integrante de proponente plural]": e.nombre,
  "[Incluir el nombre del representante legal de la persona jurídica]": e.representanteLegal ?? "",
  "[Incluir el NIT]": e.nit,
  "[identificada con NIT __________]": `identificada con NIT ${e.nit}`,
  "[identificada con el NIT __________]": `identificada con el NIT ${e.nit}`,
  "[Incluir el número de identificación]": e.ccRepresentante ?? "",
  "[Incluir número de identificación del titular de datos sensibles]": e.ccRepresentante ?? "",
  "[Indicar si actúa como representante legal o revisor fiscal]": "Representante Legal",
  "[Indicar si actúa como representante legal o revisor fiscal o ambos]": "Representante Legal",
  "[Dirección de la compañía]": e.direccion ?? "",
  "[Teléfono de la compañía]": e.telefonoComercial ?? "",
  "[Fecha en que se puso de presente la autorización y entregó sus datos]": hoy,
};
if (e.actividadPrincipal?.fechaInicio) {
  // ⚠ Tomada del inicio de actividad en el RUT — verificar contra la fecha de constitución del CCB.
  identidad["[fecha de constitución]"] = fechaLarga(e.actividadPrincipal.fechaInicio);
}

// Algunas entidades (ej. Bucaramanga) no usan placeholders entre corchetes sino blancos
// con línea de subrayado tras una etiqueta ("Razón social: ______"). diligenciar.py no
// puede resolverlos con reemplazo literal porque el largo de la línea varía, así que se
// usa regex — cada patrón rellena SOLO el/los blanco(s) que puede mapear con certeza; si
// una frase tiene otro blanco ambiguo en el medio (ej. ciudad de expedición de una
// cédula), el regex se corta antes de ese punto y lo deja intacto para revisión humana.
const ahora = new Date();
const opsFecha = { timeZone: "America/Bogota" } as const;
const diaHoy = ahora.toLocaleDateString("es-CO", { ...opsFecha, day: "numeric" });
const mesHoyTexto = ahora.toLocaleDateString("es-CO", { ...opsFecha, month: "long" });
const anioHoy = ahora.toLocaleDateString("es-CO", { ...opsFecha, year: "numeric" });
const nit = e.nit;
const repLegal = e.representanteLegal ?? "";
const cc = e.ccRepresentante ?? "";

const reemplazosRegex: Array<{ regex: string; reemplazo: string; etiqueta: string }> = [
  // Bloque de datos de contacto de la empresa/persona ("Nombre completo: ___", etc.)
  { regex: "(nombre\\s+completo\\s*:\\s*)_{3,}", reemplazo: `\\g<1>${repLegal}`, etiqueta: "Nombre completo" },
  { regex: "(tipo\\s+y\\s+n[uú]mero\\s+de\\s+documento\\s*:\\s*)_{3,}", reemplazo: `\\g<1>Cédula de Ciudadanía No. ${cc}`, etiqueta: "Tipo y número de documento" },
  { regex: "(raz[oó]n\\s+social\\s*:\\s*)_{3,}", reemplazo: `\\g<1>${e.nombre}`, etiqueta: "Razón social" },
  { regex: "(nit\\s*o\\s*c\\.?\\s*c\\.?\\s*:\\s*)_{3,}", reemplazo: `\\g<1>${nit}`, etiqueta: "NIT o C.C." },
  { regex: "(direcci[oó]n\\s*:\\s*)_{3,}", reemplazo: `\\g<1>${e.direccion ?? ""}`, etiqueta: "Dirección" },
  { regex: "(ciudad\\s*:\\s*)_{3,}", reemplazo: `\\g<1>${ciudad}`, etiqueta: "Ciudad" },
  { regex: "(tel[eé]fono\\s*:\\s*)_{3,}", reemplazo: `\\g<1>${e.telefonoComercial ?? ""}`, etiqueta: "Teléfono" },
  { regex: "(correo\\s+electr[oó]nico\\s*:\\s*)_{3,}", reemplazo: `\\g<1>${e.emailGerencia ?? ""}`, etiqueta: "Correo electrónico" },

  // Referencia / objeto / régimen tributario
  { regex: "(referencia\\s*:\\s*proceso\\s*no\\.?\\s*)_{3,}", reemplazo: `\\g<1>${numeroProceso}`, etiqueta: "Referencia: Proceso No." },
  ...(objetoProceso
    ? [{ regex: "(objeto\\s+contractual\\s*:\\s*)_{3,}", reemplazo: `\\g<1>${objetoProceso}`, etiqueta: "Objeto contractual" }]
    : []),
  { regex: "(el\\s+r[eé]gimen\\s+tributario\\s+al\\s+cual\\s+pertenecemos\\s+es\\s*:\\s*)_{3,}", reemplazo: `\\g<1>${manifiesto.empresa.regimen ?? ""}`, etiqueta: "Régimen tributario" },

  // Fechas de apertura simples ("CIUDAD, ____ de ______ de 202__" / "el día ___ de ____ de 2026")
  { regex: `${ciudad}\\s*,\\s*_{2,}\\s*de\\s*_{2,}\\s*de\\s*202_{1,}`, reemplazo: `${ciudad}, ${diaHoy} de ${mesHoyTexto} de ${anioHoy}`, etiqueta: "Fecha de apertura (formato largo)" },
  { regex: "(el\\s+d[ií]a\\s*)_{2,}(\\s*de\\s*)_{2,}(\\s*de\\s*20\\d\\d)", reemplazo: `\\g<1>${diaHoy}\\g<2>${mesHoyTexto}\\g<3>`, etiqueta: "Fecha de apertura (formato corto)" },

  // Checkbox "Calidad en la que actúa: Persona natural ___ / Representante legal ___"
  { regex: "(persona\\s+natural\\s*)_{2,}(\\s*/\\s*representante\\s+legal\\s*)_{2,}", reemplazo: "\\g<1>___\\g<2>X", etiqueta: "Calidad en la que actúa" },

  // Fórmulas de identificación del firmante ("El suscrito/Yo, ___ identificado con
  // cédula ___ de ___") — nombre, número de cédula y ciudad de expedición (regla de
  // negocio confirmada 2026-07-29: CC 11.341.797 expedida en Zipaquirá).
  { regex: "(el\\s+suscrito,\\s*)_{3,}(\\s*identificado\\s+con\\s+c[eé]dula\\s+de\\s+ciudadan[ií]a\\s+n[°º]?\\s*)_{3,}\\s*(de)\\s*_{3,}", reemplazo: `\\g<1>${repLegal}\\g<2>${cc} \\g<3> ${e.ccExpedidaEn ?? ""}`, etiqueta: "El suscrito, ___ identificado con cédula..." },
  { regex: "(yo,\\s*)_{3,}(,?\\s*identificado\\(a\\)\\s*con\\s*c[eé]dula\\s*de\\s*ciudadan[ií]a\\s*no\\.?\\s*)_{3,}", reemplazo: `\\g<1>${repLegal}\\g<2>${cc}`, etiqueta: "Yo, ___ identificado(a) con cédula de ciudadanía No..." },
  { regex: "(yo,\\s*)_{3,}(\\s*identificado\\s*\\(a\\)\\s*con\\s*c\\.?c\\.?\\s*)_{3,}\\s*(de)\\s*_{3,}", reemplazo: `\\g<1>${repLegal}\\g<2>${cc} \\g<3> ${e.ccExpedidaEn ?? ""}`, etiqueta: "Yo, ___ identificado (a) con C.C. ___" },
  { regex: "(el\\s*\\(los\\)\\s*suscrito\\s*\\(s\\)\\s*a\\s*saber\\s*)_{3,}", reemplazo: `\\g<1>${repLegal}`, etiqueta: "El (los) suscrito (s) a saber ___" },
  { regex: "(identificado\\s+con\\s+la\\s+c[eé]dula\\s+de\\s+ciudadan[ií]a\\s+no\\.?\\s*)_{3,}(\\s*,\\s*expedida\\s+en\\s*)_{3,}", reemplazo: `\\g<1>${cc}\\g<2>${e.ccExpedidaEn ?? ""}`, etiqueta: "identificado con la cédula de ciudadanía No. ___, expedida en ___" },

  // "en representación de ___" / "representante legal de la entidad ___" / NIT de la entidad
  // Estos pegan el valor tras una PALABRA real ("de", "entidad", "natural", "sociedad") — el
  // \s* queda fuera del grupo capturado para poder forzar exactamente un espacio en el
  // reemplazo, sin importar si la plantilla original tenía 0 o más espacios ahí.
  { regex: "(en\\s+representaci[oó]n\\s+de)\\s*_{3,}", reemplazo: `\\g<1> ${e.nombre}`, etiqueta: "en representación de ___" },
  { regex: "(representante\\s*legal\\s*de\\s*la\\s*entidad)\\s*_{3,}", reemplazo: `\\g<1> ${e.nombre}`, etiqueta: "representante legal de la entidad ___" },
  { regex: "(representante\\s+legal\\s+de\\s+la\\s+sociedad)\\s*_{3,}(,?\\s*identificada\\s+con\\s+nit\\s+no\\.?\\s*)_{3,}", reemplazo: `\\g<1> ${e.nombre}\\g<2>${nit}`, etiqueta: "representante legal de la sociedad ___, identificada con NIT No. ___" },
  { regex: "(identificada\\s*con\\s*nit\\.?\\s*n[°º])\\s*_{3,}", reemplazo: `\\g<1> ${nit}`, etiqueta: "identificada con Nit. N° ___" },
  { regex: "(con\\s*nit\\s*y\\/o\\s*n[°º])\\s*_{3,}", reemplazo: `\\g<1> ${nit}`, etiqueta: "con Nit y/o N° ___" },
  { regex: "(acredita\\s*que\\s*la\\s*persona\\s*jur[ií]dica\\s*o\\s*natural)\\s*_{3,}", reemplazo: `\\g<1> ${e.nombre}`, etiqueta: "acredita que la persona jurídica o natural ___" },

  // Número del proceso en frases tipo "Mínima cuantía Nº ___" (varias variantes de espaciado)
  { regex: "(m[ií]nima\\s+cuant[ií]a\\s+n[°º]\\s*)_{2,}", reemplazo: `\\g<1>${numeroProceso}`, etiqueta: "Mínima cuantía Nº ___" },

  // ── Reglas de negocio confirmadas por Santiago 2026-07-29 (aplican a TODA propuesta) ──
  // Responsable de IVA: SIEMPRE "SI" para Verde Ecológico. La frase real es "Manifiesto
  // que SI ____ NO ____ soy responsable del IVA." — checkbox con el blanco ANTES de la
  // etiqueta, se marca ahí con X (no se reescribe toda la frase).
  ...(e.responsableIVA
    ? [{ regex: "(manifiesto\\s+que\\s+si\\s*)_{2,}(\\s*no\\s*)_{2,}(\\s*soy\\s+responsable\\s+del\\s+iva)", reemplazo: "\\g<1>X\\g<2>___\\g<3>", etiqueta: "Manifiesto que SI ___ NO ___ soy responsable del IVA" }]
    : []),
  // Vigencia de la oferta: siempre 30 días calendario (regla de negocio, no del pliego).
  { regex: "(vigencia\\s*de)_{2,}(\\s*d[ií]as\\s+calendario)", reemplazo: "\\g<1> 30\\g<2>", etiqueta: "Vigencia de la propuesta (___ días calendario)" },
  // NUNCA llenar "consta de ___ (folios)" — regla de negocio explícita (Santiago 2026-07-29):
  // el número de folios se determina al armar/imprimir el expediente final, no antes.
  // No agregar un patrón para esto.
];

// Plantillas a diligenciar, identificadas por palabras clave del CONTENIDO del nombre —
// la numeración de formatos cambia entre entidades (ej. Seguridad Social fue "Formato 4"
// en Caldas y "Formato 6" en Cali), así que nunca anclar al número.
// Se omiten: proponente plural, experiencia (xlsx), capacidad financiera de extranjeros,
// acuerdo de consorcio/UT, acreditación de oferta técnica, matriz de riesgos y aceptación
// de la oferta (la firma la entidad).
const PLANTILLAS: Array<{ patron: RegExp; ancla?: string }> = [
  { patron: /carta de presentaci/i, ancla: "Firma del proponente o de su representante legal" },
  { patron: /seguridad social|aportes legales/i, ancla: "Nombre y firma" },
  { patron: /factores de desempate/i, ancla: "Firma" },
  { patron: /tratamiento de datos/i, ancla: "Incluir firma del titular" },
  { patron: /pacto de transparencia|compromiso de transparencia/i, ancla: "Firma" },
  { patron: /anticorrup/i, ancla: "Firma" },
  { patron: /inhabilidades/i, ancla: "Firma" },
  { patron: /sanciones administrativas/i, ancla: "Firma" },
  { patron: /lavado de activos/i, ancla: "Firma" },
];

// Algunos pliegos empaquetan TODOS los anexos en un solo .docx separados por encabezados
// "ANEXO N" (ya visto en Rama Judicial y en alcaldías) — diligenciar.py solo sabe llenar
// un formato con un ancla de firma por archivo, así que se separan primero en archivos
// independientes con dividirAnexos.py; el resto del flujo los trata igual que si hubieran
// venido separados del pliego.
function dividirCombinadosSiAplica(dir: string, archivos: string[]): string[] {
  const yaDivididos = archivos.filter((a) => /^ANEXO\s+\d+\s*-/i.test(a));
  const candidatos = archivos.filter(
    (a) => a.toLowerCase().endsWith(".docx") && !/^ANEXO\s+\d+\s*-/i.test(a) && !yaDivididos.length
  );

  const archivosGenerados: string[] = [];
  for (const archivo of candidatos) {
    const rutaSpec = path.join(os.tmpdir(), `dividir-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
    fs.writeFileSync(rutaSpec, JSON.stringify({ origen: path.join(dir, archivo), salidaDir: dir }));
    try {
      const salida = execFileSync("python3", [path.join(__dirname, "dividirAnexos.py"), rutaSpec], {
        encoding: "utf-8",
      });
      const reporte = JSON.parse(salida.trim()) as { generados: string[] };
      if (reporte.generados.length > 0) {
        console.log(`  ⤷ ${archivo}: combinaba ${reporte.generados.length} anexos — separados en archivos independientes`);
        archivosGenerados.push(...reporte.generados.map((r) => path.basename(r)));
      }
    } catch (err) {
      console.warn(`  ⚠ No se pudo evaluar si ${archivo} es un combinado: ${(err as Error).message.slice(0, 120)}`);
    } finally {
      fs.rmSync(rutaSpec, { force: true });
    }
  }
  return archivosGenerados;
}

// ── Ejecución ──────────────────────────────────────────────────────────────

const dirDescargados = path.join(carpetaEmpresa(NIT), "descargados", idProceso);
const dirGenerados = path.join(carpetaEmpresa(NIT), "generados", idProceso);
fs.mkdirSync(dirGenerados, { recursive: true });

let archivos = fs.existsSync(dirDescargados) ? fs.readdirSync(dirDescargados) : [];
if (archivos.length === 0) {
  console.error(`No hay plantillas descargadas en ${dirDescargados} — corre antes sesion-asistida (descargarTodo).`);
  process.exit(1);
}

const separados = dividirCombinadosSiAplica(dirDescargados, archivos);
if (separados.length > 0) {
  archivos = fs.readdirSync(dirDescargados);
}

console.log(`=== Diligenciando plantillas de ${idProceso} (${numeroProceso}) ===`);
console.log(`Empresa: ${e.nombre} · Firma escaneada: ${rutaFirma ? "sí" : "no disponible"}\n`);

interface Reporte {
  salida: string;
  reemplazosXml: number;
  reemplazosParrafo: number;
  reemplazosRegex: number;
  firmaInsertada: boolean;
  pendientes: string[];
}

const pendientesGlobales: Array<{ archivo: string; pendientes: string[] }> = [];
let generados = 0;

for (const { patron, ancla } of PLANTILLAS) {
  const archivo = archivos.find((a) => a.endsWith(".docx") && patron.test(a));
  if (!archivo) {
    console.log(`· No se encontró plantilla para ${patron} — se omite.`);
    continue;
  }

  const salida = path.join(dirGenerados, archivo.replace(/\.docx$/i, " - DILIGENCIADO.docx"));
  const spec = {
    plantilla: path.join(dirDescargados, archivo),
    salida,
    reemplazos: { ...comunes, ...identidad },
    reemplazosRegex,
    ...(rutaFirma && ancla ? { firma: { imagen: rutaFirma, ancla, anchoCm: 5 } } : {}),
  };

  const rutaSpec = path.join(os.tmpdir(), `diligenciar-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
  fs.writeFileSync(rutaSpec, JSON.stringify(spec));
  try {
    const salidaPy = execFileSync("python3", [path.join(__dirname, "diligenciar.py"), rutaSpec], {
      encoding: "utf-8",
    });
    const reporte = JSON.parse(salidaPy.trim().split("\n").pop()!) as Reporte;
    generados++;
    console.log(`✓ ${archivo}`);
    console.log(
      `    ${reporte.reemplazosXml + reporte.reemplazosParrafo + reporte.reemplazosRegex} campos diligenciados · firma: ${
        reporte.firmaInsertada ? "insertada" : "NO insertada"
      }`
    );
    if (reporte.pendientes.length > 0) {
      pendientesGlobales.push({ archivo, pendientes: reporte.pendientes });
    }
  } catch (err) {
    console.error(`✗ ${archivo}: ${(err as Error).message.slice(0, 200)}`);
  } finally {
    fs.rmSync(rutaSpec, { force: true });
  }
}

if (pendientesGlobales.length > 0) {
  console.log("\n=== Campos que requieren decisión humana (no se inventan respuestas legales) ===");
  for (const { archivo, pendientes } of pendientesGlobales) {
    console.log(`\n${archivo}:`);
    pendientes.forEach((p) => console.log(`  □ ${p}`));
  }
}

if (generados === 0) {
  console.error(
    "\n✗ Ninguna plantilla del pliego coincidió con los patrones conocidos — 0 documentos generados."
  );
  console.error(
    `  Plantillas disponibles en ${dirDescargados}: revisa si este pliego usa formatos combinados u otro esquema de nombres.`
  );
  process.exit(1);
}

console.log(`\n${generados} documentos en: ${dirGenerados}`);
