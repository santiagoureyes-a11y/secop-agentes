import { documentosFaltantesOVencidos, leerManifiesto } from "./manifest.js";
import { generarDocumentosProceso } from "./generarDocumentos.js";

const NIT_VERDE_ECOLOGICO = "900520676-4";

const manifiesto = leerManifiesto(NIT_VERDE_ECOLOGICO);
const faltantes = documentosFaltantesOVencidos(manifiesto);

console.log("=== Documentos de empresa: estado ===");
if (faltantes.length === 0) {
  console.log("Todos los documentos están presentes y vigentes.");
} else {
  for (const f of faltantes) {
    console.log(`- ${f.tipo}: ${f.motivo === "falta" ? "FALTA" : "VENCIDO"}`);
  }
  console.log(
    "\nMientras falten estos documentos, los archivos generados abajo son solo un ejercicio " +
      "de calibración — no se pueden radicar ofertas reales sin ellos."
  );
}

// Ejemplo de calibración: mismos datos del proceso real CO1.REQ.10532988 y el resultado del
// Agente Financiero ya verificado en la sesión anterior.
const { cartaPresentacion, ofertaEconomica } = generarDocumentosProceso(
  { nombre: manifiesto.empresa.nombre, nit: manifiesto.empresa.nit, representanteLegal: manifiesto.empresa.representanteLegal },
  {
    idProceso: "CO1.REQ.10532988",
    entidad: "CENTRAL ADMINISTRATIVA ESPECIALIZADA INGENIEROS CENAC INGENIEROS",
    objeto:
      "CONTRATAR LA INTERVENTORÍA TÉCNICA, ADMINISTRATIVA, FINANCIERA, AMBIENTAL, JURÍDICA Y CONTABLE AL MANTENIMIENTO A TODO COSTO DE LAS BATERÍAS SANITARIAS",
    valorBase: 59_524_000,
  },
  {
    subtotalCostosDirectos: 34_652_370.84,
    utilidad: 1_039_571.13,
    imprevistos: 346_523.71,
    iva: 6_847_308.48,
    costoTotalCotizar: 42_885_774.15,
    valorRecomendado: 48_809_680,
  }
);

console.log("\n=== Documentos generados (ejercicio de calibración) ===");
console.log(cartaPresentacion);
console.log(ofertaEconomica);
