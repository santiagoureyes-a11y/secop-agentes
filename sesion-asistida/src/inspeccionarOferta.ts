import path from "node:path";
import { fileURLToPath } from "node:url";
import { iniciarSesion } from "./iniciarSesion.js";
import { esperarConfirmacionHumana } from "./esperarHumano.js";
import type { EmpresaSesion } from "./tipos.js";
import type { Page } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
process.loadEnvFile?.(path.join(__dirname, "..", "..", "dashboard", "backend", ".env"));

const DASHBOARD_URL = process.env.DASHBOARD_URL ?? "https://secop-agentes-production.up.railway.app";

interface ElementoInteractivo {
  tipo: string;
  tag: string;
  texto: string;
  id: string;
  clases: string;
  name: string;
  href: string;
  selector: string;
}

async function volcarElementos(page: Page): Promise<ElementoInteractivo[]> {
  return page.evaluate(() => {
    const elementos: Array<{
      tipo: string;
      tag: string;
      texto: string;
      id: string;
      clases: string;
      name: string;
      href: string;
      selector: string;
    }> = [];

    const candidatos = document.querySelectorAll(
      'button, input[type="button"], input[type="submit"], a[href], select, input[type="file"], input[type="text"], input[type="number"]'
    );

    candidatos.forEach((el) => {
      const htmlEl = el as HTMLElement;
      const texto = (htmlEl.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 80);
      const id = el.id;
      const clases = Array.from(el.classList).join(" ");
      const name = (el as HTMLInputElement).name ?? "";
      const href = (el as HTMLAnchorElement).href ?? "";
      const tag = el.tagName.toLowerCase();

      // Solo incluir elementos visibles con texto relevante o por tipo especial
      const esArchivo = (el as HTMLInputElement).type === "file";
      const esNumero = (el as HTMLInputElement).type === "number";
      const tieneTexto = texto.length > 0;

      if (!esArchivo && !esNumero && !tieneTexto && !name) return;

      const selector = id
        ? `#${id}`
        : name
        ? `[name="${name}"]`
        : clases
        ? `${tag}.${clases.split(" ")[0]}`
        : tag;

      elementos.push({
        tipo: (el as HTMLInputElement).type ?? tag,
        tag,
        texto,
        id,
        clases,
        name,
        href: href.slice(0, 120),
        selector,
      });
    });

    return elementos;
  });
}

function imprimirElementos(elementos: ElementoInteractivo[], titulo: string) {
  console.log(`\n${"=".repeat(70)}`);
  console.log(titulo);
  console.log("=".repeat(70));
  elementos.forEach((el, i) => {
    const partes = [
      `[${i + 1}] <${el.tag} type="${el.tipo}">`,
      el.id ? `  ID:      #${el.id}` : null,
      el.name ? `  NAME:    [name="${el.name}"]` : null,
      el.texto ? `  TEXTO:   "${el.texto}"` : null,
      el.clases ? `  CLASES:  ${el.clases}` : null,
      el.href ? `  HREF:    ${el.href}` : null,
      `  SELECTOR SUGERIDO: ${el.selector}`,
    ].filter(Boolean);
    console.log(partes.join("\n"));
    console.log();
  });
}

async function inspeccionarProceso(empresa: EmpresaSesion, urlProceso: string, idProceso: string) {
  console.log(`\nInspección de oferta para: ${idProceso}`);
  console.log(`URL: ${urlProceso}\n`);

  const contexto = await iniciarSesion(empresa);
  const page = contexto.pages()[0] ?? (await contexto.newPage());

  // ── PASO 1: Página principal del proceso ─────────────────────────────────
  console.log("Navegando a la página del proceso...");
  await page.goto(urlProceso);
  await page.waitForLoadState("networkidle").catch(() => {});

  const elementosPrincipal = await volcarElementos(page);
  imprimirElementos(elementosPrincipal, `PASO 1 — Página principal del proceso (${idProceso})`);
  console.log(`URL actual: ${page.url()}`);

  await esperarConfirmacionHumana(
    'Mira el Chrome y el output de arriba. Identifica el botón de "Manifestar interés" o "Presentar propuesta".\n' +
    "  → Dime: ¿cuál es el selector del botón (ID, texto, o clase CSS)?\n" +
    '  → Cuando estés listo para que el script haga CLIC en ese botón, dilo en el chat\n' +
    "    y el asistente creará la señal para continuar."
  );

  // ── PASO 2: Buscar y hacer clic en "Manifestar interés" ──────────────────
  // Intentamos múltiples selectores candidatos (los más comunes en SECOP II).
  const candidatosManifestacion = [
    'a:has-text("Manifestar interés")',
    'button:has-text("Manifestar interés")',
    'a:has-text("Presentar propuesta")',
    'button:has-text("Presentar propuesta")',
    'a:has-text("Participar")',
    'input[value*="anifest"]',
    'input[value*="ropuesta"]',
  ];

  let clicExitoso = false;
  for (const sel of candidatosManifestacion) {
    try {
      const visible = await page.locator(sel).isVisible({ timeout: 2000 });
      if (visible) {
        console.log(`\nEncontrado: ${sel} — haciendo clic...`);
        await page.locator(sel).click();
        clicExitoso = true;
        break;
      }
    } catch {
      // No encontrado con este selector, probar el siguiente
    }
  }

  if (!clicExitoso) {
    console.log("\n⚠ No se encontró automáticamente el botón con los selectores candidatos.");
    console.log("  Haz clic tú mismo en Chrome en el botón correcto.");
    await esperarConfirmacionHumana(
      "Haz clic manualmente en Chrome en el botón de manifestar interés/presentar propuesta y dime cuándo lo hayas hecho."
    );
  }

  await page.waitForLoadState("networkidle").catch(() => {});

  // ── PASO 3: Página del formulario de oferta ───────────────────────────────
  console.log(`\nURL tras el clic: ${page.url()}`);
  const elementosFormulario = await volcarElementos(page);
  imprimirElementos(elementosFormulario, "PASO 3 — Formulario de oferta (tras clic en manifestar interés)");

  await esperarConfirmacionHumana(
    "Mira el formulario en Chrome y el output de arriba.\n" +
    "  Identifica y dime:\n" +
    "  1. El selector del campo de VALOR DE OFERTA (input numérico)\n" +
    "  2. El selector del input FILE para subir documentos\n" +
    "  3. ¿Hay un selector de tipo de documento (select/dropdown) antes de cada archivo?\n" +
    "  4. ¿Cuál es el selector del botón GUARDAR (no el de publicar/radicar)?\n" +
    "  → Cuando hayas anotado todo, crea la señal para continuar."
  );

  // ── PASO 4: Limpiar ────────────────────────────────────────────────────────
  await contexto.close();
  console.log("\nInspección completa. Con la información de arriba ya podemos implementar cargarOferta.ts.");
  console.log("Pega el output de consola en el chat para que el asistente lo procese.");
}

// ── Punto de entrada ─────────────────────────────────────────────────────────
const EMPRESA: EmpresaSesion = { nombreEnv: "VERDE_ECOLOGICO", nit: "900520676-4" };
const urlArg = process.argv[2];
const idProcesoArg = process.argv[3] ?? "desconocido";

async function main() {
  let urlProceso = urlArg;

  if (!urlProceso) {
    // Si no se pasa URL por argumento, tomar el proceso en aprobado_radicar del dashboard
    console.log("No se pasó URL — buscando proceso aprobado_radicar en el dashboard...");
    const res = await fetch(`${DASHBOARD_URL}/api/procesos`);
    if (!res.ok) throw new Error(`No se pudo leer procesos del dashboard: HTTP ${res.status}`);
    const procesos = (await res.json()) as Array<{ idProceso: string; urlProceso: string; estado: string }>;
    const candidato = procesos.find((p) => p.estado === "aprobado_radicar");
    if (!candidato) throw new Error("No hay procesos en estado aprobado_radicar — pasa la URL manualmente como argumento.");
    urlProceso = candidato.urlProceso;
    console.log(`Proceso encontrado: ${candidato.idProceso}`);
    await inspeccionarProceso(EMPRESA, urlProceso, candidato.idProceso);
    return;
  }

  await inspeccionarProceso(EMPRESA, urlProceso, idProcesoArg);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
