import { notificarGerente } from "../../config/email.js";
import type { Proceso } from "@prisma/client";

function formatearMoneda(valor: number | null) {
  if (valor === null) return "—";
  return valor.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
}

// Gate 1: el correo es solo un aviso — la aprobación real se hace en el dashboard.
// Se dispara cuando el Agente Financiero termina de cotizar (estado -> "cotizado").
export function notificarCostoYGanancia(proceso: Proceso) {
  return notificarGerente(
    `[SECOP] Revisar costeo: ${proceso.entidad}`,
    [
      `Proceso ${proceso.idProceso} — ${proceso.entidad}`,
      `Objeto: ${proceso.objeto}`,
      `Valor sugerido a cotizar: ${formatearMoneda(proceso.valorSugerido)}`,
      `Margen esperado: ${proceso.margenEsperado !== null ? `${(proceso.margenEsperado * 100).toFixed(0)}%` : "—"}`,
      `Riesgo: ${proceso.riesgo ?? "—"}`,
      "",
      "Revisa y aprueba en el dashboard para continuar con la carga de documentos.",
    ].join("\n")
  );
}

// Gate 2: aviso antes de publicar/radicar, después de que los documentos ya están cargados.
export function notificarListoParaPublicar(proceso: Proceso) {
  return notificarGerente(
    `[SECOP] Listo para radicar: ${proceso.entidad}`,
    [
      `Proceso ${proceso.idProceso} — ${proceso.entidad}`,
      "Los documentos ya están cargados y listos para radicación.",
      "Da la aprobación final en el dashboard antes de publicar la participación.",
    ].join("\n")
  );
}
