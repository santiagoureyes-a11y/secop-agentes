/**
 * Diligencia las plantillas oficiales (.docx) descargadas de un proceso con los datos
 * reales de la empresa (manifest.json) y la firma manuscrita escaneada.
 *
 * El reemplazo dentro de los .docx lo hace src/diligenciar.py (python-docx, ya instalado
 * en el sistema): ver ahí la justificación técnica de las dos pasadas.
 *
 * Uso:
 *   npx tsx src/diligenciarPlantillas.ts <idProceso> <numeroProceso> <entidad> <ciudad> [direccionEntidad]
 * Ejemplo:
 *   npx tsx src/diligenciarPlantillas.ts CO1.REQ.10558278 MIC-SI-028-2026 "GOBERNACION DE CALDAS" Manizales
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

const [idProceso, numeroProceso, entidad, ciudad, direccionEntidad] = process.argv.slice(2);
if (!idProceso || !numeroProceso || !entidad || !ciudad) {
  console.error(
    "Uso: npx tsx src/diligenciarPlantillas.ts <idProceso> <numeroProceso> <entidad> <ciudad> [direccionEntidad]"
  );
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

// Plantillas a diligenciar: patrón de nombre de archivo → ancla de firma (si aplica).
// Formato 2 (proponente plural), Anexo 2 (lo firma la entidad) y Matriz de riesgos se omiten.
const PLANTILLAS: Array<{ patron: RegExp; ancla?: string }> = [
  { patron: /formato 1 .*carta/i, ancla: "Firma del proponente o de su representante legal" },
  { patron: /formato 4 .*seguridad/i, ancla: "Nombre y firma" },
  { patron: /formato 5 .*desempate/i, ancla: "Firma" },
  { patron: /formato 6 .*tratamiento de datos/i, ancla: "Incluir firma del titular" },
  { patron: /anexo 1 .*pacto de transparencia/i, ancla: "Firma" },
];

// ── Ejecución ──────────────────────────────────────────────────────────────

const dirDescargados = path.join(carpetaEmpresa(NIT), "descargados", idProceso);
const dirGenerados = path.join(carpetaEmpresa(NIT), "generados", idProceso);
fs.mkdirSync(dirGenerados, { recursive: true });

const archivos = fs.existsSync(dirDescargados) ? fs.readdirSync(dirDescargados) : [];
if (archivos.length === 0) {
  console.error(`No hay plantillas descargadas en ${dirDescargados} — corre antes sesion-asistida (descargarTodo).`);
  process.exit(1);
}

console.log(`=== Diligenciando plantillas de ${idProceso} (${numeroProceso}) ===`);
console.log(`Empresa: ${e.nombre} · Firma escaneada: ${rutaFirma ? "sí" : "no disponible"}\n`);

interface Reporte {
  salida: string;
  reemplazosXml: number;
  reemplazosParrafo: number;
  firmaInsertada: boolean;
  pendientes: string[];
}

const pendientesGlobales: Array<{ archivo: string; pendientes: string[] }> = [];

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
    ...(rutaFirma && ancla ? { firma: { imagen: rutaFirma, ancla, anchoCm: 5 } } : {}),
  };

  const rutaSpec = path.join(os.tmpdir(), `diligenciar-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
  fs.writeFileSync(rutaSpec, JSON.stringify(spec));
  try {
    const salidaPy = execFileSync("python3", [path.join(__dirname, "diligenciar.py"), rutaSpec], {
      encoding: "utf-8",
    });
    const reporte = JSON.parse(salidaPy.trim().split("\n").pop()!) as Reporte;
    console.log(`✓ ${archivo}`);
    console.log(
      `    ${reporte.reemplazosXml + reporte.reemplazosParrafo} campos diligenciados · firma: ${
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

console.log(`\nDocumentos en: ${dirGenerados}`);
