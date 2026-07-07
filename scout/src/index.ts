import { buscarProcesos } from "./client.js";
import type { PerfilEmpresa, Proceso } from "./types.js";

const DASHBOARD_URL = process.env.DASHBOARD_URL ?? "https://secop-agentes-production.up.railway.app";
const EMPRESA_ID = process.env.EMPRESA_ID ?? "cmr1dkcak0000cee3wf92nl26";

const perfilVerdeEcologico: PerfilEmpresa = {
  codigosUnspsc: [],
  modalidades: ["Mínima cuantía"],
  palabraClaveObligatoria: "INTERVENTOR",
  palabrasClaveAlguna: ["TECNIC", "ADMINISTRATIV", "CONTABLE"],
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

const procesos = await buscarProcesos(perfilVerdeEcologico, { limite: 20 });
console.log(`Procesos encontrados: ${procesos.length}`);

let enviados = 0;
let duplicados = 0;
for (const p of procesos) {
  const ok = await enviarAlDashboard(p);
  if (ok) {
    enviados++;
    console.log(`  ✓ [${p.id_del_proceso}] ${p.nombre_del_procedimiento?.slice(0, 60)}`);
  } else {
    duplicados++;
    console.log(`  · [${p.id_del_proceso}] ya existe en el dashboard`);
  }
}

console.log(`\nResumen: ${enviados} nuevos, ${duplicados} ya existían.`);
