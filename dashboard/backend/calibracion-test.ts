import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { notificarGerente } from "./src/config/email.js";

const prisma = new PrismaClient();

const proceso = await prisma.proceso.update({
  where: { idProceso: "CO1.REQ.10532988" },
  data: {
    valorSugerido: 48_809_680,
    margenEsperado: 0.138,
    riesgo: "bajo",
    estado: "cotizado",
  },
});

await notificarGerente(
  `[CALIBRACIÓN — no es un proceso real a aprobar] Revisar costeo: ${proceso.entidad}`,
  [
    "Este correo es parte de una prueba de calibración del sistema de agentes SECOP, no requiere acción.",
    "",
    `Proceso ${proceso.idProceso} — ${proceso.entidad}`,
    `Objeto: ${proceso.objeto}`,
    `Valor sugerido a cotizar: $${proceso.valorSugerido?.toLocaleString("es-CO")}`,
    `Margen esperado: ${((proceso.margenEsperado ?? 0) * 100).toFixed(1)}%`,
    `Riesgo: ${proceso.riesgo}`,
    "",
    "(Calibración del Agente Financiero — verificando que el cálculo y la notificación funcionan end-to-end.)",
  ].join("\n")
);

console.log("Proceso actualizado y notificación de calibración enviada.");
await prisma.$disconnect();
