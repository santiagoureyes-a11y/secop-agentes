import { buscarProcesos } from "./client.js";
import type { PerfilEmpresa } from "./types.js";

// Perfil real de la empresa (Verde Ecológico) — criterios confirmados con el dueño del
// proceso el 2026-06-27. Sin restricción geográfica: a nivel nacional.
const perfilVerdeEcologico: PerfilEmpresa = {
  codigosUnspsc: [],
  modalidades: ["Mínima cuantía"],
  palabraClaveObligatoria: "INTERVENTOR",
  palabrasClaveAlguna: ["TECNIC", "ADMINISTRATIV", "CONTABLE"],
  precioMaximo: 200_000_000,
  diasPublicacionMax: 30,
};

const procesos = await buscarProcesos(perfilVerdeEcologico, { limite: 20 });

console.log(`Procesos encontrados: ${procesos.length}`);
for (const p of procesos) {
  console.log(`- [${p.id_del_proceso}] ${p.nombre_del_procedimiento} (${p.entidad}) — ${p.estado_resumen}`);
}
