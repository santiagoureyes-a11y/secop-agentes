/**
 * suscribirYCargar.ts
 *
 * 1. Abre la sesión autenticada de SECOP II
 * 2. Navega al proceso indicado por el orquestador (env PROCESO_URL / PROCESO_ID)
 * 3. Hace clic en "Crear Oferta" / "Manifestar Interés"
 * 4. Sube los documentos generados en ~/secop-documentos/{nit}/generados/{idProceso}/
 * 5. PARA antes de publicar — el humano revisa y envía manualmente
 *
 * NUNCA hace clic en "Enviar Oferta" / "Publicar" / "Radicar".
 */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import type { Page } from "playwright";
import { iniciarSesion } from "./iniciarSesion.js";
import { esperarConfirmacionHumana } from "./esperarHumano.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
process.loadEnvFile?.(path.join(__dirname, "..", "..", "dashboard", "backend", ".env"));

// Red de seguridad: SECOP II es ASP.NET WebForms y algunos clics disparan un postback de
// página completa que destruye el execution context de Playwright a mitad de una consulta
// al DOM. El loop de subida de documentos ya está protegido puntualmente; esto cubre
// cualquier otro punto del script (volcarBotones, clicPorTexto, etc.) con el mismo riesgo,
// para terminar con un mensaje claro en vez de un stack trace crudo sin contexto.
process.on("unhandledRejection", (err) => {
  console.error("\n✗ Error no manejado:", (err as Error)?.message ?? err);
  console.error("  Probable postback/navegación de SECOP a mitad de una operación.");
  console.error("  La ventana de Chrome puede seguir abierta con la sesión activa — revisa el estado ahí.");
  process.exit(1);
});

// ── Configuración del proceso (inyectada por el orquestador vía env) ──────
const NIT = "900520676-4";
const URL_PROCESO = process.env.PROCESO_URL ?? "";
const ID_PROCESO = process.env.PROCESO_ID ?? "";
const VALOR_OFERTA = Number(process.env.PROCESO_PRESUPUESTO ?? 0); // valor aprobado en dashboard (puerta #2)

if (!URL_PROCESO || !ID_PROCESO) {
  console.error(
    "Faltan PROCESO_URL / PROCESO_ID. Este script lo invoca el orquestador; para correrlo a mano:\n" +
      '  PROCESO_ID=CO1.REQ.xxx PROCESO_URL="https://community.secop.gov.co/..." PROCESO_PRESUPUESTO=0 npx tsx sesion-asistida/src/suscribirYCargar.ts'
  );
  process.exit(1);
}

const GENERADOS = path.join(os.homedir(), "secop-documentos", NIT, "generados", ID_PROCESO);

// Archivos a subir: todos los diligenciados presentes en la carpeta del proceso
const DOCUMENTOS: Array<{ etiqueta: string; archivo: string }> = fs.existsSync(GENERADOS)
  ? fs
      .readdirSync(GENERADOS)
      .filter((f) => !f.startsWith(".") && /\.(docx|xlsx|pdf)$/i.test(f))
      .sort()
      .map((f) => ({
        etiqueta: f.replace(/\.(docx|xlsx|pdf)$/i, ""),
        archivo: path.join(GENERADOS, f),
      }))
  : [];

if (DOCUMENTOS.length === 0) {
  console.error(
    `No hay documentos generados en ${GENERADOS} — corre el agente documental (diligenciarPlantillas) antes de suscribir.`
  );
  process.exit(1);
}

// ── Helpers ────────────────────────────────────────────────────────────────

async function pausar(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Espera a que aparezca cualquiera de los selectores dados. */
async function esperarCualquiera(page: Page, selectores: string[], timeout = 15_000) {
  return Promise.race(
    selectores.map((s) =>
      page
        .waitForSelector(s, { timeout, state: "visible" })
        .then(() => s)
        .catch(() => null)
    )
  );
}

/** Vuelca todos los botones y links de la página para diagnóstico. */
async function volcarBotones(page: Page) {
  const items = await page.evaluate(() => {
    return Array.from(
      document.querySelectorAll('button, a, input[type="submit"], input[type="button"]')
    )
      .filter((el) => (el as HTMLElement).offsetParent !== null)
      .map((el) => ({
        tag: el.tagName,
        id: el.id,
        text: (el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 60),
        class: el.className.slice(0, 60),
      }))
      .filter((e) => e.text.length > 0);
  });
  return items;
}

/** Intenta hacer clic en el primer selector que exista y sea visible. */
async function clicPrimeroVisible(page: Page, selectores: string[]): Promise<string | null> {
  for (const sel of selectores) {
    try {
      const el = await page.$(sel);
      if (!el) continue;
      const visible = await el.isVisible();
      if (visible) {
        await el.click();
        console.log(`  ✓ Clic en: ${sel}`);
        return sel;
      }
    } catch {
      // ignorar
    }
  }
  return null;
}

/** Busca entre todos los elementos visibles el que contenga cierto texto. */
async function clicPorTexto(page: Page, textos: string[]): Promise<boolean> {
  for (const texto of textos) {
    try {
      const locator = page.locator(`text=${texto}`).first();
      if (await locator.isVisible({ timeout: 3_000 })) {
        await locator.click();
        console.log(`  ✓ Clic por texto: "${texto}"`);
        return true;
      }
    } catch {
      // ignorar
    }
  }
  return false;
}

// ── Script principal ───────────────────────────────────────────────────────

(async () => {
  console.log("\n=== SECOP II — Suscribir y cargar documentos ===");
  console.log(`Proceso: ${ID_PROCESO}`);
  console.log(`Valor oferta: $${VALOR_OFERTA.toLocaleString("es-CO")}`);

  const contexto = await iniciarSesion({ nombreEnv: "VERDE_ECOLOGICO", nit: NIT });
  const page = contexto.pages()[0] ?? (await contexto.newPage());

  // ─── Paso 1: Navegar al proceso ─────────────────────────────────────────
  console.log("\n[1/5] Navegando al proceso...");
  await page.goto(URL_PROCESO, { waitUntil: "domcontentloaded", timeout: 45_000 });

  // Esperar a que cargue la sección autenticada del proceso (SECOP usa AJAX/UpdatePanels).
  // Buscamos cualquier elemento que indique que el contenido del proceso ya está presente.
  const selectorContenidoProceso = [
    "#ctl00_ContentPlaceHolder1_UpdatePanel1",
    "#dvProcesDetail",
    "#btnCreateBid",
    "table.detail-table",
    "div[id*='Process']",
    "div[id*='process']",
    ".panel-body",
    "h2, h3",  // al menos debe haber un título en la página
  ].join(", ");

  await page.waitForSelector(selectorContenidoProceso, { timeout: 20_000 }).catch(() => {
    console.log("  (El contenido del proceso puede tardar — continuando de todas formas)");
  });
  await pausar(4_000); // tiempo adicional para que el AJAX de SECOP II termine

  // Vuelco diagnóstico COMPLETO (sin slice)
  const botonesInicio = await volcarBotones(page);
  console.log(`  ${botonesInicio.length} botones/links visibles en la página del proceso:`);
  botonesInicio.forEach((b) => console.log(`    [${b.tag}] id="${b.id}" → "${b.text}"`));

  // ─── Paso 2: Acceder a la oportunidad / Crear oferta ────────────────────
  console.log("\n[2/5] Buscando botón para acceder/crear oferta...");

  // "Acceder a la oportunidad" es el botón de suscripción en procesos de Mínima Cuantía.
  // Después de hacer clic, aparece el formulario de oferta con documentos y valor económico.
  const creadoPor = await clicPorTexto(page, [
    // Botones de acceso/suscripción
    "Acceder a la oportunidad",
    "Acceder a la Oportunidad",
    "Acceder Oportunidad",
    "Expresar interés",
    "Expresar Interés",
    "Manifestar Interés",
    "Manifestar interés",
    // Botones de edición de oferta (si ya se accedió)
    "Crear Oferta",
    "Crear oferta",
    "Editar Oferta",
    "Editar oferta",
    "Ver Oferta",
    "Ver oferta",
    "Agregar Oferta",
    "Presentar Oferta",
    "Nueva Oferta",
    "Iniciar Oferta",
  ]);

  if (!creadoPor) {
    const porId = await clicPrimeroVisible(page, [
      // Botones de acceder a la oportunidad (IDs típicos de SECOP II)
      "#btnAccessOpportunity",
      "#lnkAccessOpportunity",
      "a[id*='Interest']",
      "a[id*='interest']",
      "button[id*='Interest']",
      // Botones de oferta
      "#btnCreateBid",
      "#btnNewOffer",
      "#lnkCreateOffer",
      "#btn_offer",
      "#btnOffer",
      "a[href*='CreateOffer']",
      "a[href*='Opportunity']",
      "a[href*='opportunity']",
      "a[href*='createoffer']",
      "a[href*='NewOffer']",
      "a[href*='Offer/Create']",
      "a[href*='OfertaEconomica']",
      "input[value*='Oferta']",
      "input[value*='oportunidad']",
      "button[id*='offer']",
      "button[id*='Offer']",
      "button[id*='bid']",
    ]);

    if (!porId) {
      console.log("\n  ⚠ No se encontró el botón automáticamente.");
      console.log("  Haz clic en 'Acceder a la oportunidad' en Chrome y cuando");
      console.log("  estés en la sección de carga de documentos, escribe 'listo'.");
      await esperarConfirmacionHumana("Navega manualmente al formulario/documentos de oferta en Chrome");
    }
  }

  // Esperar que la página cargue tras el clic
  await pausar(5_000);
  await page.waitForLoadState("domcontentloaded").catch(() => {});

  // Vuelco completo DESPUÉS del clic para ver qué apareció
  const botonesPostClic = await volcarBotones(page);
  console.log(`\n  ${botonesPostClic.length} elementos después del clic/señal:`);
  botonesPostClic.forEach((b) =>
    console.log(`    [${b.tag}] id="${b.id}" class="${b.class.slice(0, 30)}" → "${b.text}"`)
  );

  // Vuelco después del clic
  const botonesOferta = await volcarBotones(page);
  console.log("\n  Elementos visibles después de intentar abrir la oferta:");
  botonesOferta.slice(0, 20).forEach((b) =>
    console.log(`    [${b.tag}] id="${b.id}" → "${b.text}"`)
  );

  // ─── Paso 3: Seleccionar empresa y acceder al formulario ────────────────
  console.log("\n[3/5] Configurando empresa y abriendo formulario de documentos...");

  // Seleccionar Verde Ecológico SAS en el desplegable si existe
  try {
    const selector = await page.$("#companiesSelector");
    if (selector) {
      await selector.selectOption({ label: "Verde Ecológico SAS" });
      console.log("  ✓ Empresa 'Verde Ecológico SAS' seleccionada");
      await pausar(2_000);
    }
  } catch {
    console.log("  (companiesSelector no necesitó cambio o no estaba visible)");
  }

  // Intentar hacer clic en el botón "IWantToContainer" (menú de acciones de SECOP II)
  console.log("  Buscando botón de acciones (IWantToContainer)...");
  const iwantBtn = await page.$("input[id*='IWantToContainer']");
  if (iwantBtn) {
    await iwantBtn.click();
    console.log("  ✓ Clic en IWantToContainer");
    await pausar(2_000);
  }

  // Volcar estado actual antes de intentar subir
  const elementosActuales = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('button, a, input, select, textarea, label'))
      .map((el) => ({
        tag: el.tagName,
        type: (el as HTMLInputElement).type ?? "",
        id: el.id,
        name: (el as HTMLInputElement).name ?? "",
        text: (el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 70),
      }))
      .filter((e) => e.text || e.type === "file");
  });
  console.log(`  ${elementosActuales.length} elementos en la página:`);
  elementosActuales.forEach((e) =>
    console.log(`    [${e.tag}/${e.type}] id="${e.id}" name="${e.name}" → "${e.text}"`)
  );

  // ─── Paso 4: Subir archivos ──────────────────────────────────────────────
  console.log("\n[4/5] Subiendo documentos...");

  // Volcar estado completo después de IWantToContainer para diagnóstico
  const elementosTras = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('button, a, input, select'))
      .map((el) => ({
        tag: el.tagName,
        type: (el as HTMLInputElement).type ?? "",
        id: el.id,
        name: (el as HTMLInputElement).name ?? "",
        text: (el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 80),
        visible: (el as HTMLElement).offsetParent !== null,
      }))
      .filter((e) => e.visible && (e.text || e.type === "file"));
  });
  console.log(`  ${elementosTras.length} elementos visibles tras IWantToContainer:`);
  elementosTras.forEach((e) =>
    console.log(`    [${e.tag}/${e.type}] id="${e.id}" → "${e.text}"`)
  );

  let totalSubidos = 0;

  for (const doc of DOCUMENTOS) {
    console.log(`\n  Intentando subir: ${doc.etiqueta}`);

    // Todo el intento por-documento va envuelto: SECOP II es una app ASP.NET WebForms y
    // el clic en "Adjuntar" a veces dispara un postback de página completa (no un AJAX de
    // UpdatePanel) que destruye el execution context de Playwright a mitad de la operación
    // ("Execution context was destroyed, most likely because of a navigation"). Sin este
    // try/catch esa excepción no capturada tumbaba todo el proceso Node — ahora se registra
    // como fallo de ESE documento y el loop continúa con el siguiente.
    try {
      // Estrategia 1: interceptar el file chooser nativo que abre el botón "Adjuntar"
      // Se configura el listener ANTES de hacer clic para no perder el evento.
      let subidoConFileChooser = false;
      try {
        const [fileChooser] = await Promise.all([
          page.waitForEvent("filechooser", { timeout: 8_000 }),
          clicPorTexto(page, [
            "Agregar documento",
            "Adjuntar",
            "Adjuntar documento",
            "Cargar documento",
            "Agregar archivo",
            "Upload",
          ]),
        ]);
        if (fileChooser) {
          await fileChooser.setFiles(doc.archivo);
          await pausar(2_000);
          const guardado = await clicPorTexto(page, ["Guardar", "Guardar y cerrar", "Confirmar", "Aceptar", "OK"]);
          if (guardado) await pausar(3_000);
          console.log(`  ✓ Subido con fileChooser: ${doc.etiqueta}`);
          totalSubidos++;
          subidoConFileChooser = true;
        }
      } catch {
        // El fileChooser no apareció en 8s — o el clic disparó un postback en vez de un
        // file chooser. Esperar a que la página se estabilice antes de seguir con la
        // estrategia 2, para no consultar el DOM a mitad de la navegación.
        await page.waitForLoadState("domcontentloaded", { timeout: 10_000 }).catch(() => {});
      }

      if (!subidoConFileChooser) {
        // Estrategia 2: buscar input[type='file'] visible u oculto y usar setInputFiles
        const fileInputs = await page.$$("input[type='file']");
        console.log(`    file inputs encontrados: ${fileInputs.length}`);
        if (fileInputs.length > 0) {
          // Forzar visibilidad si está oculto (SECOP II a veces oculta el input real)
          await fileInputs[0].evaluate((el) => {
            (el as HTMLElement).style.display = "block";
            (el as HTMLElement).style.opacity = "1";
          });
          await fileInputs[0].setInputFiles(doc.archivo, { timeout: 30_000 });
          await pausar(2_000);
          const guardado = await clicPorTexto(page, ["Guardar", "Guardar y cerrar", "Confirmar", "Aceptar", "OK"]);
          if (guardado) await pausar(3_000);
          console.log(`  ✓ Subido con setInputFiles: ${doc.etiqueta}`);
          totalSubidos++;
        } else {
          console.log(`  ⚠ Sin file input para ${doc.etiqueta}`);
        }
      }
    } catch (err) {
      console.error(`  ✗ Error subiendo ${doc.etiqueta}: ${(err as Error).message.slice(0, 150)}`);
      console.error(`    (probable postback de SECOP a mitad del intento — continúa con el siguiente documento)`);
    }
  }

  if (totalSubidos < DOCUMENTOS.length) {
    console.log(`\n  Subidos automáticamente: ${totalSubidos}/${DOCUMENTOS.length}`);
    console.log(`  Archivos en ${GENERADOS}/:`);
    DOCUMENTOS.forEach((d, i) => {
      const subido = i < totalSubidos ? "✓" : "✗";
      console.log(`    ${subido} ${d.etiqueta}`);
      console.log(`      ${d.archivo}`);
    });
    await esperarConfirmacionHumana(
      `Sube manualmente los archivos en Chrome (pestaña Documentos / cada pregunta tiene su botón Adjuntar) y confirma (subidos: ${totalSubidos}/${DOCUMENTOS.length})`
    );
  }

  // ─── Paso 5: STOP — NO publicar ─────────────────────────────────────────
  console.log("\n[5/5] DETENIDO — no se publicará automáticamente.");
  console.log("════════════════════════════════════════════════════════════════");
  console.log("  La oferta está lista para revisión en Chrome.");
  console.log("  Revisa que todos los documentos estén cargados correctamente.");
  console.log("  Cuando quieras publicar, hazlo MANUALMENTE en la ventana de Chrome.");
  console.log("════════════════════════════════════════════════════════════════");

  await esperarConfirmacionHumana(
    "Revisa la oferta en Chrome y cuando hayas publicado (o decidas no publicar), confirma aquí"
  );

  await contexto.close();
  process.exit(0);
})();
