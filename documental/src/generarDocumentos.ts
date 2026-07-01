import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { carpetaEmpresa } from "./manifest.js";

export interface DatosEmpresa {
  nombre: string;
  nit: string;
  representanteLegal?: string;
}

export interface DatosProceso {
  idProceso: string;
  entidad: string;
  objeto: string;
  valorBase: number;
}

// Mismos campos que produce financiero/src/calculadora.ts — se repiten aquí (sin import
// cruzado entre paquetes npm independientes) para no acoplar documental/ a la forma interna
// de financiero/.
export interface ResumenCotizacion {
  subtotalCostosDirectos: number;
  utilidad: number;
  imprevistos: number;
  iva: number;
  costoTotalCotizar: number;
  valorRecomendado: number;
}

function formatearMoneda(valor: number): string {
  return valor.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
}

function carpetaGenerados(nit: string, idProceso: string): string {
  const dir = path.join(carpetaEmpresa(nit), "generados", idProceso);
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function generarCartaPresentacion(empresa: DatosEmpresa, proceso: DatosProceso): string {
  return [
    "CARTA DE PRESENTACIÓN DE LA OFERTA",
    "",
    `Proceso: ${proceso.idProceso}`,
    `Entidad: ${proceso.entidad}`,
    `Objeto: ${proceso.objeto}`,
    "",
    `El suscrito, en representación de ${empresa.nombre} (NIT ${empresa.nit}), presenta oferta`,
    "para participar en el proceso de la referencia, manifestando que conoce y acepta los",
    "términos y condiciones del pliego de condiciones / invitación pública.",
    "",
    `${empresa.representanteLegal ?? "[REPRESENTANTE LEGAL PENDIENTE EN EL MANIFIESTO DE EMPRESA]"}`,
    `${empresa.nombre}`,
    `NIT ${empresa.nit}`,
  ].join("\n");
}

export function generarOfertaEconomica(
  empresa: DatosEmpresa,
  proceso: DatosProceso,
  resumen: ResumenCotizacion
): string {
  return [
    "OFERTA ECONÓMICA",
    "",
    `Proceso: ${proceso.idProceso} — ${proceso.entidad}`,
    `Objeto: ${proceso.objeto}`,
    `Presupuesto oficial: ${formatearMoneda(proceso.valorBase)}`,
    "",
    `Subtotal costos directos: ${formatearMoneda(resumen.subtotalCostosDirectos)}`,
    `Utilidad + imprevistos:    ${formatearMoneda(resumen.utilidad + resumen.imprevistos)}`,
    `IVA (19%):                 ${formatearMoneda(resumen.iva)}`,
    `Costo total calculado:     ${formatearMoneda(resumen.costoTotalCotizar)}`,
    "",
    `VALOR DE LA OFERTA: ${formatearMoneda(resumen.valorRecomendado)}`,
    "",
    `${empresa.nombre} — NIT ${empresa.nit}`,
  ].join("\n");
}

// Genera ambos documentos como texto plano en ~/secop-documentos/<nit>/generados/<idProceso>/.
// La conversión a PDF con el formato exacto del pliego queda para cuando se tenga un caso
// real que lo exija — no se agrega una librería de generación de PDF sin esa justificación.
export function generarDocumentosProceso(
  empresa: DatosEmpresa,
  proceso: DatosProceso,
  resumen: ResumenCotizacion
): { cartaPresentacion: string; ofertaEconomica: string } {
  const dir = carpetaGenerados(empresa.nit, proceso.idProceso);

  const cartaPresentacion = path.join(dir, "carta-presentacion.txt");
  const ofertaEconomica = path.join(dir, "oferta-economica.txt");

  writeFileSync(cartaPresentacion, generarCartaPresentacion(empresa, proceso));
  writeFileSync(ofertaEconomica, generarOfertaEconomica(empresa, proceso, resumen));

  return { cartaPresentacion, ofertaEconomica };
}
