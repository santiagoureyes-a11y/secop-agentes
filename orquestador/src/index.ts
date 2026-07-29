/**
 * Orquestador local — pollea el dashboard Railway y dispara los agentes
 * automáticamente cuando el gerente cambia el estado de un proceso.
 *
 * Estados que disparan agentes:
 *   aprobado_cotizar  → sesion-asistida/leerYCalcular.ts  (descarga pliego + calcula)
 *   aprobado_radicar  → documental/diligenciar.py         (genera documentos)
 *
 * El script corre indefinidamente. Para arrancarlo:
 *   cd ~/secop-agentes && npx tsx orquestador/src/index.ts
 */

import { spawn } from "node:child_process";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(__dirname, "..", "..");

// Cargar .env del backend para DASHBOARD_URL y credenciales SECOP
const ENV_FILE = path.join(RAIZ, "dashboard", "backend", ".env");
process.loadEnvFile?.(ENV_FILE);

const DASHBOARD_URL = process.env.DASHBOARD_URL ?? "https://secop-agentes-production.up.railway.app";
const POLL_MS = 30_000; // 30 segundos

// Tracking para no disparar el mismo agente dos veces por el mismo proceso+estado
const enProceso = new Set<string>(); // `${dbId}-${estado}`

// Cada agente abre Chrome — sin tope, un fallo persistente abriría ventanas cada 30s.
const intentosFallidos = new Map<string, number>();
const MAX_INTENTOS = 3;

function registrarFallo(clave: string, idProceso: string): void {
  const n = (intentosFallidos.get(clave) ?? 0) + 1;
  intentosFallidos.set(clave, n);
  if (n < MAX_INTENTOS) {
    enProceso.delete(clave); // permitir reintento en el próximo tick
  } else {
    console.error(
      `[${idProceso}] ✗ ${MAX_INTENTOS} intentos fallidos — no se reintentará más. Corrige la causa y reinicia el orquestador.`
    );
  }
}

interface Proceso {
  id: string;
  idProceso: string;
  entidad: string;
  objeto: string;
  valorBase: number | null;
  estado: string;
  valorSugerido: number | null;
  urlProceso: string | null;
  empresa: { nit: string };
  documentos: unknown[];
}

async function obtenerProcesos(): Promise<Proceso[]> {
  const res = await fetch(`${DASHBOARD_URL}/api/procesos`);
  if (!res.ok) throw new Error(`Dashboard no responde: ${res.status}`);
  return res.json();
}

// Spawna un script tsx y loguea su salida con prefijo del proceso
function ejecutarScript(
  script: string,
  env: Record<string, string>,
  idProceso: string,
  args: string[] = []
): Promise<void> {
  return new Promise((resolve, reject) => {
    const prefijo = `[${idProceso}]`;
    const proc = spawn("npx", ["tsx", script, ...args], {
      cwd: RAIZ,
      env: { ...process.env, ...env },
      stdio: ["ignore", "pipe", "pipe"],
    });

    proc.stdout.on("data", (d: Buffer) =>
      d.toString().split("\n").filter(Boolean).forEach((l) => console.log(`${prefijo} ${l}`))
    );
    proc.stderr.on("data", (d: Buffer) =>
      d.toString().split("\n").filter(Boolean).forEach((l) => console.error(`${prefijo} ⚠ ${l}`))
    );

    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${script} salió con código ${code}`));
    });
  });
}

async function manejarAprobadoCotizar(proc: Proceso) {
  if (!proc.urlProceso) {
    console.log(`[${proc.idProceso}] ⚠ Sin URL de proceso — no se puede descargar pliego`);
    return;
  }
  if (!proc.valorBase) {
    console.log(`[${proc.idProceso}] ⚠ Sin presupuesto — no se puede calcular`);
    return;
  }

  console.log(`\n▶ Financiero auto: ${proc.idProceso}`);
  console.log(`  ${proc.entidad}`);
  console.log(`  ${proc.objeto}`);
  console.log(`  Presupuesto: $${proc.valorBase.toLocaleString("es-CO")}`);

  await ejecutarScript("sesion-asistida/src/leerYCalcular.ts", {
    PROCESO_DBID: proc.id,
    PROCESO_ID: proc.idProceso,
    PROCESO_URL: proc.urlProceso,
    PROCESO_PRESUPUESTO: String(proc.valorBase),
  }, proc.idProceso);
}

async function manejarAprobadoRadicar(proc: Proceso) {
  console.log(`\n▶ Documental auto: ${proc.idProceso}`);
  console.log(`  Genera documentos con datos del pliego y suscribe en SECOP II`);

  // 1. Diligenciar las plantillas del pliego con datos de la empresa. El número interno
  //    del proceso, entidad y ciudad salen de datos-pliego.json / Datos Abiertos — si
  //    falta un dato del pliego, el script aborta en vez de inventarlo.
  await ejecutarScript("documental/src/diligenciarPlantillas.ts", {}, proc.idProceso, [proc.idProceso]);

  // 2. Suscribir y subir lo generado. Chrome visible — se pausa antes de publicar.
  await ejecutarScript("sesion-asistida/src/suscribirYCargar.ts", {
    PROCESO_DBID: proc.id,
    PROCESO_ID: proc.idProceso,
    PROCESO_URL: proc.urlProceso ?? "",
    PROCESO_PRESUPUESTO: String(proc.valorSugerido ?? proc.valorBase ?? 0),
  }, proc.idProceso);
}

async function tick() {
  let procesos: Proceso[];
  try {
    procesos = await obtenerProcesos();
  } catch (err) {
    console.error(`[tick] No se pudo contactar el dashboard: ${(err as Error).message}`);
    return;
  }

  for (const proc of procesos) {
    const claveFinanciero = `${proc.id}-aprobado_cotizar`;
    const claveDocumental = `${proc.id}-aprobado_radicar`;

    if (proc.estado === "aprobado_cotizar" && !proc.valorSugerido && !enProceso.has(claveFinanciero)) {
      enProceso.add(claveFinanciero);
      manejarAprobadoCotizar(proc)
        .then(() => console.log(`[${proc.idProceso}] ✅ Financiero completado`))
        .catch((err) => {
          console.error(`[${proc.idProceso}] ✗ Error Financiero: ${(err as Error).message}`);
          registrarFallo(claveFinanciero, proc.idProceso);
        });
    }

    if (proc.estado === "aprobado_radicar" && proc.documentos.length === 0 && !enProceso.has(claveDocumental)) {
      enProceso.add(claveDocumental);
      manejarAprobadoRadicar(proc)
        .then(() => console.log(`[${proc.idProceso}] ✅ Documental completado`))
        .catch((err) => {
          console.error(`[${proc.idProceso}] ✗ Error Documental: ${(err as Error).message}`);
          registrarFallo(claveDocumental, proc.idProceso);
        });
    }
  }
}

// ── Main loop ──────────────────────────────────────────────────────────────
console.log("=== Orquestador SECOP II ===");
console.log(`Dashboard: ${DASHBOARD_URL}`);
console.log(`Intervalo de polling: ${POLL_MS / 1000}s`);
console.log("Esperando cambios de estado...\n");

async function loop() {
  await tick();
  setTimeout(loop, POLL_MS);
}

loop().catch(console.error);
