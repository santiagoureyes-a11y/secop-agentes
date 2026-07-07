// Descarga TODOS los documentos de un proceso dado (sin filtro de relevancia).
// Uso: npx tsx src/descargarTodo.ts <urlProceso> <idProceso> [procesoDbId]
// Ejemplo automatico para CO1.REQ.10558278 si no se pasan argumentos.

import path from "node:path";
import { fileURLToPath } from "node:url";
import { iniciarSesion } from "./iniciarSesion.js";
import { descargarDocumento, listarDocumentos } from "./descargarDocumentos.js";
import fs from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
process.loadEnvFile?.(path.join(__dirname, "..", "..", "dashboard", "backend", ".env"));

const DASHBOARD_URL = process.env.DASHBOARD_URL ?? "https://secop-agentes-production.up.railway.app";

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
    console.log(`  ↑ Subido: ${nombre}`);
  } else {
    console.warn(`  ⚠ No se pudo subir ${nombre}: ${res.status}`);
  }
}

const URL_PROCESO =
  process.argv[2] ??
  "https://community.secop.gov.co/Public/Tendering/OpportunityDetail/Index?noticeUID=CO1.NTC.10418579";
const ID_PROCESO = process.argv[3] ?? "CO1.REQ.10558278";
const PROCESO_DB_ID = process.argv[4] ?? "cmr1dldra0002cee320sjrnka";
const NIT = "900520676-4";

(async () => {
  const contexto = await iniciarSesion({ nombreEnv: "VERDE_ECOLOGICO", nit: NIT });
  const page = contexto.pages()[0] ?? (await contexto.newPage());

  console.log(`\nAbriendo proceso: ${URL_PROCESO}`);
  await page.goto(URL_PROCESO);

  await page.waitForSelector("#grdGridDocumentList_tbl", { timeout: 30_000 }).catch(() => {
    console.warn("Tabla de documentos no apareció en 30s. Revisando lo que hay...");
  });

  const documentos = await listarDocumentos(page);
  console.log(`\n=== ${documentos.length} documentos encontrados ===`);
  documentos.forEach((d, i) => console.log(`  ${String(i + 1).padStart(2, "0")}. ${d.nombre}`));

  console.log("\n=== Descargando todos ===");
  for (const doc of documentos) {
    try {
      const ruta = await descargarDocumento(page, doc, NIT, ID_PROCESO);
      console.log(`  ✓ ${doc.nombre}`);
      if (PROCESO_DB_ID) await subirArchivo(PROCESO_DB_ID, ruta);
    } catch (err) {
      console.error(`  ✗ ${doc.nombre}: ${(err as Error).message}`);
    }
  }

  console.log("\nListo. Documentos guardados en:");
  console.log(`  ~/secop-documentos/${NIT}/descargados/${ID_PROCESO}/`);

  await contexto.close();
  process.exit(0);
})();
