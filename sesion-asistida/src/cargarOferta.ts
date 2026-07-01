import { iniciarSesion } from "./iniciarSesion.js";
import type { EmpresaSesion } from "./tipos.js";

export interface ArchivoAdjuntar {
  tipoDocumento: string; // debe coincidir con el tipo que pide el formulario de SECOP
  rutaArchivo: string; // ruta absoluta en ~/secop-documentos/<nit>/...
}

// FASE 2 — diseñado, pendiente de implementar selectores reales del formulario de oferta
// (solo se puede inspeccionar una vez se tenga sesión autenticada sobre un proceso real).
// Reglas que esta función SIEMPRE debe respetar:
//   1. Nunca hace clic en el botón final de "Enviar oferta" / "Radicar" — se detiene antes
//      y le pide al humano que revise y confirme manualmente.
//   2. Si reaparece un captcha en cualquier paso, pausa y espera confirmación humana
//      (igual que iniciarSesion.ts) — nunca asume que ya se resolvió antes.
export async function cargarOferta(
  empresa: EmpresaSesion,
  urlProceso: string,
  valorOferta: number,
  archivos: ArchivoAdjuntar[]
): Promise<void> {
  const contexto = await iniciarSesion(empresa);
  const page = contexto.pages()[0] ?? (await contexto.newPage());
  await page.goto(urlProceso);

  throw new Error(
    "cargarOferta aún no está implementado: faltan los selectores reales del formulario de " +
      "oferta económica y de carga de archivos de SECOP. Implementar una vez se tenga acceso " +
      "autenticado a un proceso real para inspeccionarlos (ver leerProceso.ts como referencia)."
  );

  // Esqueleto previsto:
  // await page.fill(SELECTOR_VALOR_OFERTA, String(valorOferta));
  // for (const archivo of archivos) {
  //   await page.setInputFiles(SELECTOR_INPUT_ARCHIVO(archivo.tipoDocumento), archivo.rutaArchivo);
  // }
  // console.log("Oferta lista para revisión — el envío final lo debe hacer un humano.");
}
