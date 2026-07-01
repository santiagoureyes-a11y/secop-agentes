import path from "node:path";
import { fileURLToPath } from "node:url";
import { iniciarSesion } from "./iniciarSesion.js";
import { descargarDocumento, listarDocumentos, type DocumentoListado } from "./descargarDocumentos.js";
import type { EmpresaSesion } from "./tipos.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
process.loadEnvFile?.(path.join(__dirname, "..", "..", "dashboard", "backend", ".env"));

export interface ResumenPliego {
  documentos: DocumentoListado[];
  descargados: string[];
}

// Documentos que típicamente contienen los requisitos de experiencia y perfiles profesionales
// (confirmado en vivo: el detalle del proceso en SECOP no trae ese texto en la página misma,
// solo en estos archivos adjuntos — ver CLAUDE.md sección 1).
const PATRON_DOCUMENTOS_RELEVANTES = /estudio previo|invitacion/i;

// Requiere una sesión ya autenticada (ver iniciarSesion.ts) — el captcha, si aparece, lo
// resuelve siempre el humano antes de llegar a esta función.
export async function leerProceso(
  empresa: EmpresaSesion,
  urlProceso: string,
  idProceso: string
): Promise<ResumenPliego> {
  const contexto = await iniciarSesion(empresa);
  const page = contexto.pages()[0] ?? (await contexto.newPage());

  await page.goto(urlProceso);
  await page.waitForSelector("#grdGridDocumentList_tbl", { timeout: 30_000 }).catch(() => {
    console.warn("La tabla de documentos no apareció en 30s — revisa manualmente en la ventana de Chrome.");
  });

  const documentos = await listarDocumentos(page);
  const relevantes = documentos.filter((d) => PATRON_DOCUMENTOS_RELEVANTES.test(d.nombre));

  const descargados: string[] = [];
  for (const doc of relevantes) {
    descargados.push(await descargarDocumento(page, doc, empresa.nit, idProceso));
  }

  return { documentos, descargados };
}

const empresaArg = process.argv[2] ?? "VERDE_ECOLOGICO";
const nitArg = process.argv[3] ?? "900000001-1";
const urlArg = process.argv[4];
const idProcesoArg = process.argv[5] ?? "desconocido";

if (
  (process.argv[1]?.endsWith("leerProceso.ts") || process.argv[1]?.endsWith("leerProceso.js")) &&
  urlArg
) {
  leerProceso({ nombreEnv: empresaArg, nit: nitArg }, urlArg, idProcesoArg)
    .then((resumen) => {
      console.log(`=== ${resumen.documentos.length} documentos encontrados en el proceso ===`);
      resumen.documentos.forEach((d) => console.log(`- ${d.nombre}`));
      console.log("\n=== Descargados (estudio previo / invitación) ===");
      resumen.descargados.forEach((ruta) => console.log(`- ${ruta}`));
      console.log("\nLee estos archivos con la herramienta Read para extraer experiencia y perfiles profesionales.");
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
