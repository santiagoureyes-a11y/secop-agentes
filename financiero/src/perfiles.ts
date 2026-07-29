import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface TablaSueldos {
  perfiles: Array<{ perfil: string; claves: string[]; sueldoBasicoMes: number }>;
  fallbackSueldoBasicoMes: number;
}

const tabla: TablaSueldos = JSON.parse(
  fs.readFileSync(path.join(__dirname, "sueldos-perfiles.json"), "utf-8")
);

function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export interface SueldoMapeado {
  perfil: string;
  sueldoBasicoMes: number;
  mapeado: boolean; // false = se usó el fallback, requiere revisión humana
}

// Mapea un cargo del pliego (ej. "INGENIERO PROCESAMIENTO") al sueldo de la tabla.
// Nunca inventa: si ningún perfil coincide, usa el fallback y lo marca `mapeado: false`
// para que la cotización lo reporte como riesgo.
export function mapearCargoASueldo(cargo: string): SueldoMapeado {
  const cargoNorm = normalizar(cargo);
  for (const p of tabla.perfiles) {
    if (p.claves.some((clave) => cargoNorm.includes(normalizar(clave)))) {
      return { perfil: p.perfil, sueldoBasicoMes: p.sueldoBasicoMes, mapeado: true };
    }
  }
  return {
    perfil: `sin mapear ("${cargo}")`,
    sueldoBasicoMes: tabla.fallbackSueldoBasicoMes,
    mapeado: false,
  };
}
