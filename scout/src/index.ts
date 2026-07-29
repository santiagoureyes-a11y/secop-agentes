import { buscarProcesos } from "./client.js";
import type { PerfilEmpresa, Proceso } from "./types.js";

const DASHBOARD_URL = process.env.DASHBOARD_URL ?? "https://secop-agentes-production.up.railway.app";
const EMPRESA_ID = process.env.EMPRESA_ID ?? "cmr1dkcak0000cee3wf92nl26";

const perfilVerdeEcologico: PerfilEmpresa = {
  codigosUnspsc: [],
  modalidades: ["Mínima cuantía"],
  palabraClaveObligatoria: "INTERVENTOR",
  // ⚠ Se quitó "palabrasClaveAlguna: [TECNIC, ADMINISTRATIV, CONTABLE]" (2026-07-30):
  // medido contra Datos Abiertos, ese filtro extra descartaba procesos de interventoría
  // reales (ej. interventoría topográfica) sin aportar precisión — el cuello de botella
  // real es que el pool de "Mínima cuantía + interventoría" vigente en todo el país es
  // naturalmente pequeño (1-2 procesos en un día cualquiera, ~41 si se cuentan todas las
  // modalidades). Correr el scout con frecuencia (diario) es lo que acumula volumen real,
  // no ampliar precio/fecha — eso ya se probó y no cambia el conteo.
  precioMaximo: 200_000_000,
  diasPublicacionMax: 30,
  soloVigentes: true,
  // Pedido del gerente (2026-07-07): solo procesos con al menos 1 día completo antes del
  // cierre — sin tiempo de preparar garantía, CCB y experiencia no vale la pena entrarlos.
  diasMinimosAntesCierre: 1,
};

async function enviarAlDashboard(proceso: Proceso): Promise<boolean> {
  const body = {
    idProceso: proceso.id_del_proceso,
    entidad: proceso.entidad ?? "Desconocida",
    objeto: proceso.nombre_del_procedimiento ?? proceso.descripci_n_del_procedimiento ?? "",
    valorBase: proceso.precio_base ? parseFloat(proceso.precio_base) : null,
    modalidad: proceso.modalidad_de_contratacion ?? null,
    fechaCierre: proceso.fecha_de_recepcion_de ?? null,
    urlProceso: proceso.urlproceso?.url ?? null,
    empresaId: EMPRESA_ID,
  };

  const res = await fetch(`${DASHBOARD_URL}/api/procesos`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  return res.ok;
}

// Depurar primero: el dashboard descarta los procesos sin radicar con cierre a <1 día
// y devuelve el cupo disponible (máximo de procesos activos — que el tablero no se
// convierta en un SECOP 2.0).
const resDepurar = await fetch(`${DASHBOARD_URL}/api/procesos/depurar`, { method: "POST" });
if (!resDepurar.ok) {
  throw new Error(`No se pudo depurar el dashboard: ${resDepurar.status}`);
}
const depuracion = (await resDepurar.json()) as {
  descartados: number;
  activos: number;
  cupoMaximo: number;
  cupoDisponible: number;
};
console.log(
  `Depuración: ${depuracion.descartados} descartados por cierre inminente · ` +
    `activos ${depuracion.activos}/${depuracion.cupoMaximo} · cupo disponible ${depuracion.cupoDisponible}`
);

const procesos = await buscarProcesos(perfilVerdeEcologico, { limite: 50 });
console.log(`Procesos encontrados: ${procesos.length}`);

// Con más candidatos que cupo, entran primero los de mayor presupuesto oficial.
procesos.sort((a, b) => parseFloat(b.precio_base ?? "0") - parseFloat(a.precio_base ?? "0"));

let enviados = 0;
let duplicados = 0;
let sinCupo = 0;
for (const p of procesos) {
  if (enviados >= depuracion.cupoDisponible) {
    sinCupo++;
    continue;
  }
  const ok = await enviarAlDashboard(p);
  if (ok) {
    enviados++;
    console.log(`  ✓ [${p.id_del_proceso}] ${p.nombre_del_procedimiento?.slice(0, 60)}`);
  } else {
    duplicados++;
    console.log(`  · [${p.id_del_proceso}] ya existe en el dashboard (o fue descartado antes)`);
  }
}

console.log(`\nResumen: ${enviados} nuevos, ${duplicados} ya existían.`);
if (sinCupo > 0) {
  console.log(
    `Sin cupo (${depuracion.cupoMaximo} activos máx.) — quedaron ${sinCupo} candidatos por fuera; ` +
      `entrarán en próximas corridas si sigue habiendo margen de cierre.`
  );
}
