/**
 * Funciones puras de extracción de datos desde el texto de los pliegos (via pdfminer).
 * Separadas de leerYCalcular para poderlas probar sin abrir Chrome ni tocar el dashboard.
 *
 * Regla del pipeline: todo dato sale del pliego con su evidencia textual; lo que no se
 * logre extraer se reporta — nunca se asume un valor en silencio.
 */

import { execSync } from "node:child_process";
import { mapearCargoASueldo } from "../../financiero/src/perfiles.js";

export function extraerTextoPdf(rutaPdf: string): string | null {
  try {
    return execSync(
      `python3 -c "from pdfminer.high_level import extract_text; print(extract_text('${rutaPdf.replace(/'/g, "\\'")}'))"`,
      { timeout: 30_000, maxBuffer: 10_000_000 }
    ).toString();
  } catch {
    return null;
  }
}

// "plazo de ejecución: 3 meses" / "cuatro (4) meses" / "cinco (5) meses y diez (10) días" / "plazo: 90 días"
export function extraerPlazo(texto: string): { meses: number; evidencia: string } | null {
  const regresMes = texto.match(
    /plazo[^.:\n]{0,80}?(\d+)\s*\)?\s*mes(?:es)?(?:[^.\n]{0,40}?(\d+)\s*\)?\s*d[ií]as?)?/i
  );
  if (regresMes) {
    const meses = parseFloat(regresMes[1]);
    const dias = regresMes[2] ? parseFloat(regresMes[2]) : 0;
    return { meses: meses + dias / 30, evidencia: regresMes[0].replace(/\s+/g, " ").trim() };
  }

  const regresDias = texto.match(/plazo[^.:\n]{0,60}?(\d+)\s*\)?\s*d[ií]a/i);
  if (regresDias) {
    return {
      meses: parseFloat(regresDias[1]) / 30,
      evidencia: regresDias[0].replace(/\s+/g, " ").trim(),
    };
  }

  return null;
}

// Número interno del proceso según la entidad — puede ser alfanumérico ("IP012_2026",
// "MIC-SI-028-2026") o puramente numérico con puntos ("4182.010.32.1.603-2026").
// Lo usan las plantillas del pliego como "[Incluir número del proceso de contratación]".
export function extraerNumeroProceso(texto: string): { numero: string; evidencia: string } | null {
  const m = texto.match(
    /(?:invitaci[oó]n\s+p[uú]blica|proceso(?:\s+de\s+contrataci[oó]n)?|m[ií]nima\s+cuant[ií]a)[^\n]{0,40}?(?:No\.?|N[°º]|n[uú]mero)\s*:?\s*([A-Z0-9][A-Z0-9\-_./]{2,30}\d)/i
  );
  if (m) return { numero: m[1].trim(), evidencia: m[0].replace(/\s+/g, " ").trim() };
  return null;
}

// ── Personal mínimo exigido por el pliego ──────────────────────────────────
// Los pliegos de interventoría suelen traer una tabla "PERSONAL MÍNIMO DE TRABAJO"
// con cantidad, cargo y dedicación. El texto de pdfminer llega desordenado (palabras
// partidas, columnas mezcladas), así que el parseo es best-effort: lo que no se logre
// interpretar queda reportado para revisión humana.
export interface RolPliego {
  cantidad: number;
  cargo: string;
  dedicacionPct: number | null; // null = no se pudo leer → se costea al 100% (conservador)
}

export function extraerPersonalMinimo(
  texto: string
): { roles: RolPliego[]; textoSeccion: string } | null {
  // "equipo de trabajo" / "personal requerido" son demasiado genéricos: aparecen también
  // en rótulos de planos técnicos ("EQUIPO DE TRABAJO: Ing. Fulano...") y otras secciones
  // ajenas al personal exigido. Se exige "mínimo" junto a personal/equipo.
  const inicio = texto.search(/personal\s+m[ií]nimo|equipo\s+m[ií]nimo/i);
  if (inicio === -1) return null;

  const seccion = texto.slice(inicio, inicio + 2_500).replace(/\s+/g, " ");

  // Pares "cantidad CARGO" (el cargo viene en mayúsculas en la tabla). Se corta ante el
  // siguiente número de la tabla o los encabezados de las columnas siguientes.
  const zonaCargos = seccion.slice(0, 400);
  const candidatos: RolPliego[] = [];
  const reRol =
    /\b([1-9]\d?)\s+([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ /.-]{3,60}?)(?=\s+[1-9]\d?\s+[A-ZÁÉÍÓÚÑ]|\s+(?:PERFIL|EXPERIEN|DEDICACI|FORMACI|REQUISIT)|$)/g;
  let m: RegExpExecArray | null;
  while ((m = reRol.exec(zonaCargos)) !== null) {
    candidatos.push({ cantidad: parseInt(m[1], 10), cargo: m[2].trim(), dedicacionPct: null });
  }
  if (candidatos.length === 0) return { roles: [], textoSeccion: seccion };

  // Validación anti-ruido: un cargo real de interventoría mapea a algún perfil conocido
  // (director, ingeniero, arquitecto, SST...) y un equipo real no supera ~10 personas por
  // rol. Direcciones o texto de planos ("CALLE 42", "FACHADA SUR") no pasan ninguna de las
  // dos pruebas — se descartan en vez de costear con ellas.
  const roles = candidatos.filter(
    (r) => r.cantidad <= 10 && mapearCargoASueldo(r.cargo).mapeado
  );
  if (roles.length === 0) return { roles: [], textoSeccion: seccion };

  // Dedicaciones: porcentajes que aparecen tras la palabra DEDICACIÓN, en el orden de los
  // roles. pdfminer puede partir la palabra ("DEDICACI ON"), así que se ancla al prefijo.
  const zonaDedicacion = seccion.match(/dedicaci[^%]{0,30}?((?:\d{1,3}\s*%[\s,y/-]*)+)/i);
  if (zonaDedicacion) {
    const pcts = [...zonaDedicacion[1].matchAll(/(\d{1,3})\s*%/g)].map((p) => parseInt(p[1], 10));
    roles.forEach((rol, i) => {
      if (pcts[i] !== undefined && pcts[i] > 0 && pcts[i] <= 100) rol.dedicacionPct = pcts[i];
    });
  }

  return { roles, textoSeccion: seccion };
}
