import { readFileSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { z } from "zod";

const DocumentoSchema = z.object({
  archivo: z.string().nullable(),
  vigenciaHasta: z.string().nullable(),
});

const ManifiestoSchema = z.object({
  empresa: z.object({ nombre: z.string(), nit: z.string() }),
  documentos: z.record(z.string(), DocumentoSchema),
  hojasDeVidaEquipo: z.array(z.unknown()),
});

export type Manifiesto = z.infer<typeof ManifiestoSchema>;

export function carpetaEmpresa(nit: string): string {
  return path.join(os.homedir(), "secop-documentos", nit);
}

export function leerManifiesto(nit: string): Manifiesto {
  const ruta = path.join(carpetaEmpresa(nit), "manifest.json");
  const contenido = readFileSync(ruta, "utf-8");
  return ManifiestoSchema.parse(JSON.parse(contenido));
}

export interface DocumentoFaltante {
  tipo: string;
  motivo: "falta" | "vencido";
}

// Responde "¿qué documentos hacen falta?" cruzando el manifiesto de la empresa contra la
// fecha actual — sin esto, el Agente Documental no debería intentar generar/cargar nada.
export function documentosFaltantesOVencidos(
  manifiesto: Manifiesto,
  fechaReferencia = new Date()
): DocumentoFaltante[] {
  const resultado: DocumentoFaltante[] = [];

  for (const [tipo, doc] of Object.entries(manifiesto.documentos)) {
    if (!doc.archivo) {
      resultado.push({ tipo, motivo: "falta" });
      continue;
    }
    if (doc.vigenciaHasta && new Date(doc.vigenciaHasta) < fechaReferencia) {
      resultado.push({ tipo, motivo: "vencido" });
    }
  }

  return resultado;
}
