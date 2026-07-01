import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { iniciarSesion } from "./iniciarSesion.js";
import { listarDocumentos, descargarDocumento } from "./descargarDocumentos.js";
import type { EmpresaSesion } from "./tipos.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
process.loadEnvFile?.(path.join(__dirname, "..", "..", "dashboard", "backend", ".env"));

const EMPRESA: EmpresaSesion = { nombreEnv: "VERDE_ECOLOGICO", nit: "900520676-4" };
const DASHBOARD_URL = process.env.DASHBOARD_URL ?? "https://secop-agentes-production.up.railway.app";

// Descarga estudios previos, invitaciones (con y sin tilde) y pliegos de condiciones.
const PATRON_RELEVANTES = /estudio.{0,8}prev|invitaci|pliego/i;

interface ProcesoApi {
  id: string;
  idProceso: string;
  urlProceso: string;
}

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
    console.warn(`  ⚠ No se pudo subir ${nombre}: HTTP ${res.status}`);
  }
}

async function main() {
  const res = await fetch(`${DASHBOARD_URL}/api/procesos`);
  if (!res.ok) throw new Error(`No se pudo leer los procesos del dashboard: HTTP ${res.status}`);
  const procesos: ProcesoApi[] = await res.json();
  console.log(`${procesos.length} procesos en el dashboard\n`);

  // Login una sola vez — si hay captcha, el script pausa y espera la señal del humano.
  const contexto = await iniciarSesion(EMPRESA);
  const page = contexto.pages()[0] ?? (await contexto.newPage());

  for (const proc of procesos) {
    console.log(`\n=== ${proc.idProceso} ===`);
    await page.goto(proc.urlProceso);

    const tablaVista = await page
      .waitForSelector("#grdGridDocumentList_tbl", { timeout: 30_000 })
      .then(() => true)
      .catch(() => false);

    if (!tablaVista) {
      console.warn("  Tabla de documentos no cargó — se omite este proceso.");
      continue;
    }

    const docs = await listarDocumentos(page);
    const relevantes = docs.filter((d) => PATRON_RELEVANTES.test(d.nombre));
    console.log(`  ${docs.length} docs encontrados, ${relevantes.length} relevantes para descargar`);

    for (const doc of relevantes) {
      try {
        const ruta = await descargarDocumento(page, doc, EMPRESA.nit, proc.idProceso);
        await subirArchivo(proc.id, ruta);
      } catch (err) {
        console.warn(`  ⚠ Error descargando ${doc.nombre}: ${(err as Error).message}`);
      }
    }
  }

  await contexto.close();
  console.log("\nListo. Todos los procesos procesados.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
