import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { iniciarSesion } from "./iniciarSesion.js";
import { descargarDocumento, listarDocumentos, type DocumentoListado } from "./descargarDocumentos.js";
import type { EmpresaSesion } from "./tipos.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
process.loadEnvFile?.(path.join(__dirname, "..", "..", "dashboard", "backend", ".env"));

const DASHBOARD_URL = process.env.DASHBOARD_URL ?? "https://secop-agentes-production.up.railway.app";

export interface ResumenPliego {
  documentos: DocumentoListado[];
  descargados: string[];
}

const PATRON_DOCUMENTOS_RELEVANTES = /estudio previo|invitacion/i;

async function subirArchivo(procesoDbId: string, rutaLocal: string) {
  const nombre = path.basename(rutaLocal);
  const buffer = fs.readFileSync(rutaLocal);
  const form = new FormData();
  form.append("archivo", new Blob([buffer]), nombre);

  const res = await fetch(`${DASHBOARD_URL}/api/procesos/${procesoDbId}/archivos`, {
    method: "POST",
    body: form,
  });

  if (res.ok) {
    console.log(`  ↑ Subido al dashboard: ${nombre}`);
  } else {
    console.warn(`  ⚠ No se pudo subir ${nombre}: ${res.status}`);
  }
}

export async function leerProceso(
  empresa: EmpresaSesion,
  urlProceso: string,
  idProceso: string,
  procesoDbId?: string
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
    const ruta = await descargarDocumento(page, doc, empresa.nit, idProceso);
    descargados.push(ruta);
    if (procesoDbId) await subirArchivo(procesoDbId, ruta);
  }

  return { documentos, descargados };
}

const empresaArg = process.argv[2] ?? "VERDE_ECOLOGICO";
const nitArg = process.argv[3] ?? "900520676-4";
const urlArg = process.argv[4];
const idProcesoArg = process.argv[5] ?? "desconocido";
const procesoDbIdArg = process.argv[6];

if (
  (process.argv[1]?.endsWith("leerProceso.ts") || process.argv[1]?.endsWith("leerProceso.js")) &&
  urlArg
) {
  leerProceso({ nombreEnv: empresaArg, nit: nitArg }, urlArg, idProcesoArg, procesoDbIdArg)
    .then((resumen) => {
      console.log(`=== ${resumen.documentos.length} documentos encontrados en el proceso ===`);
      resumen.documentos.forEach((d) => console.log(`- ${d.nombre}`));
      console.log("\n=== Descargados y subidos al dashboard ===");
      resumen.descargados.forEach((ruta) => console.log(`- ${ruta}`));
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
