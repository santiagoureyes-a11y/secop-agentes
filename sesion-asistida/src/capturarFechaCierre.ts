/**
 * capturarFechaCierre.ts
 *
 * Datos Abiertos trunca la hora de cierre a las 00:00 — la hora real solo está en la
 * página del proceso en SECOP II (cronograma: "Fecha de presentación de ofertas").
 * Este script la captura con la sesión asistida y la sube al dashboard
 * (PATCH /api/procesos/:id/fecha-cierre), que la marca como hora confirmada.
 *
 * Uso:
 *   npx tsx src/capturarFechaCierre.ts                     → todos los procesos activos sin hora confirmada
 *   npx tsx src/capturarFechaCierre.ts <urlProceso> <dbId> → un proceso puntual
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Page } from "playwright";
import { iniciarSesion } from "./iniciarSesion.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
process.loadEnvFile?.(path.join(__dirname, "..", "..", "dashboard", "backend", ".env"));

const DASHBOARD_URL = process.env.DASHBOARD_URL ?? "https://secop-agentes-production.up.railway.app";
const NIT = "900520676-4";

const ESTADOS_TERMINALES = new Set(["descartado", "rechazado", "adjudicado"]);

// Etiquetas del cronograma de SECOP II que corresponden al cierre de recepción de ofertas.
const PATRON_ETIQUETA_CIERRE = /presentaci[oó]n de ofertas|recepci[oó]n de (ofertas|respuestas)|fecha l[ií]mite/i;

// "06/07/2026 10:30:00 AM" | "06/07/2026 16:30" — SECOP muestra fechas en hora de Colombia.
const PATRON_FECHA_HORA = /(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::\d{2})?\s*(a\.?\s?m\.?|p\.?\s?m\.?|am|pm)?/i;

interface ProcesoDashboard {
  id: string;
  idProceso: string;
  urlProceso: string | null;
  estado: string;
  horaCierreConfirmada?: boolean;
}

/** Convierte el match del patrón a ISO con offset fijo de Colombia (-05:00, sin DST). */
function aIsoBogota(m: RegExpMatchArray): string {
  const [, dia, mes, anio, horaStr, min, ampm] = m;
  let hora = Number(horaStr);
  if (ampm) {
    const esPm = /p/i.test(ampm);
    if (esPm && hora < 12) hora += 12;
    if (!esPm && hora === 12) hora = 0;
  }
  const dd = dia.padStart(2, "0");
  const mm = mes.padStart(2, "0");
  const hh = String(hora).padStart(2, "0");
  return `${anio}-${mm}-${dd}T${hh}:${min}:00-05:00`;
}

/** Busca en la página la fila del cronograma con la fecha de presentación de ofertas. */
async function extraerFechaCierre(page: Page): Promise<string | null> {
  // Recolecta pares etiqueta→texto de filas de tablas y bloques etiqueta/valor genéricos,
  // sin depender de IDs concretos (el layout de SECOP II varía entre módulos).
  const filas = await page.evaluate(() => {
    const resultado: Array<{ etiqueta: string; texto: string }> = [];
    for (const tr of Array.from(document.querySelectorAll("tr"))) {
      const celdas = Array.from(tr.querySelectorAll("th, td")).map((c) =>
        (c.textContent ?? "").trim().replace(/\s+/g, " ")
      );
      if (celdas.length >= 2 && celdas[0]) {
        resultado.push({ etiqueta: celdas[0], texto: celdas.slice(1).join(" ") });
      }
    }
    // Bloques tipo <label>Etiqueta</label><span>Valor</span> o divs de detalle
    for (const label of Array.from(document.querySelectorAll("label, strong, dt"))) {
      const etiqueta = (label.textContent ?? "").trim().replace(/\s+/g, " ");
      const valor = (label.nextElementSibling?.textContent ?? label.parentElement?.textContent ?? "")
        .trim()
        .replace(/\s+/g, " ");
      if (etiqueta) resultado.push({ etiqueta, texto: valor });
    }
    return resultado;
  });

  for (const fila of filas) {
    if (!PATRON_ETIQUETA_CIERRE.test(fila.etiqueta)) continue;
    const m = fila.texto.match(PATRON_FECHA_HORA) ?? fila.etiqueta.match(PATRON_FECHA_HORA);
    if (m) return aIsoBogota(m);
  }
  return null;
}

async function actualizarEnDashboard(dbId: string, fechaIso: string): Promise<boolean> {
  const res = await fetch(`${DASHBOARD_URL}/api/procesos/${dbId}/fecha-cierre`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fechaCierre: fechaIso }),
  });
  return res.ok;
}

(async () => {
  const urlArg = process.argv[2];
  const dbIdArg = process.argv[3];

  let pendientes: ProcesoDashboard[];
  if (urlArg && dbIdArg) {
    pendientes = [{ id: dbIdArg, idProceso: "(argumento)", urlProceso: urlArg, estado: "manual" }];
  } else {
    const res = await fetch(`${DASHBOARD_URL}/api/procesos`);
    if (!res.ok) throw new Error(`Dashboard respondió ${res.status}`);
    const todos = (await res.json()) as ProcesoDashboard[];
    pendientes = todos.filter(
      (p) => p.urlProceso && !p.horaCierreConfirmada && !ESTADOS_TERMINALES.has(p.estado)
    );
  }

  if (pendientes.length === 0) {
    console.log("No hay procesos pendientes de confirmar hora de cierre.");
    process.exit(0);
  }

  console.log(`Procesos a revisar: ${pendientes.length}`);
  const contexto = await iniciarSesion({ nombreEnv: "VERDE_ECOLOGICO", nit: NIT });
  const page = contexto.pages()[0] ?? (await contexto.newPage());

  for (const proceso of pendientes) {
    console.log(`\n→ ${proceso.idProceso}`);
    try {
      await page.goto(proceso.urlProceso!, { waitUntil: "domcontentloaded", timeout: 45_000 });
      // Dar tiempo a los UpdatePanels de SECOP II
      await page.waitForTimeout(4_000);

      const fechaIso = await extraerFechaCierre(page);
      if (!fechaIso) {
        console.warn("  ⚠ No se encontró la fecha de presentación de ofertas en la página.");
        continue;
      }
      console.log(`  Cierre real: ${fechaIso}`);
      const ok = await actualizarEnDashboard(proceso.id, fechaIso);
      console.log(ok ? "  ✓ Actualizado en el dashboard" : "  ✗ El dashboard rechazó la actualización");
    } catch (err) {
      console.error(`  ✗ ${(err as Error).message.slice(0, 140)}`);
    }
  }

  await contexto.close();
  process.exit(0);
})();
