import { existsSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import os from "node:os";

// Este script normalmente se ejecuta en segundo plano (controlado por el asistente, no por
// una terminal donde el humano pueda escribir directamente). Por eso la confirmación humana
// no usa stdin/readline: el humano resuelve el captcha en la ventana de Chrome y avisa en el
// chat ("listo"); el asistente crea este archivo de señal, y el script lo detecta por polling.
// Nunca se intenta leer/resolver el captcha desde el script — eso es exclusivamente humano.
export function archivoSenalCaptcha(): string {
  return path.join(os.tmpdir(), "secop-captcha-resuelto.signal");
}

export async function esperarConfirmacionHumana(mensaje: string): Promise<void> {
  const archivo = archivoSenalCaptcha();
  if (existsSync(archivo)) rmSync(archivo);

  console.log(`\n>>> ${mensaje}`);
  console.log(`>>> Cuando termines, dilo en el chat — el asistente creará: ${archivo}`);

  while (!existsSync(archivo)) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  rmSync(archivo);
  console.log(">>> Confirmación recibida, continuando...");
}
