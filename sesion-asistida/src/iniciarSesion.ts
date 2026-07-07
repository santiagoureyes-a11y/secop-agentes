import path from "node:path";
import { fileURLToPath } from "node:url";
import { abrirContextoPersistente, credenciales, SECOP_LOGIN_URL } from "./contexto.js";
import { esperarConfirmacionHumana } from "./esperarHumano.js";
import type { EmpresaSesion } from "./tipos.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Carga las variables del .env del dashboard (ahí viven SECOP_<EMPRESA>_USER/_PASS).
process.loadEnvFile?.(path.join(__dirname, "..", "..", "dashboard", "backend", ".env"));

// Selectores reales del formulario de login (verificados contra la página pública de
// community.secop.gov.co, sin necesidad de loguearse — solo se inspeccionó el HTML del
// formulario, que es público).
const SELECTOR_USUARIO = "#txtUserName";
const SELECTOR_PASSWORD = "#txtPassword";
const SELECTOR_BOTON_LOGIN = "#btnLoginButton";
const SELECTOR_CAPTCHA_TEXTO = "#txttxtCaptcha";

export async function iniciarSesion(empresa: EmpresaSesion) {
  const { usuario, password } = credenciales(empresa);
  const contexto = await abrirContextoPersistente(empresa);
  const page = contexto.pages()[0] ?? (await contexto.newPage());

  await page.goto(SECOP_LOGIN_URL, { waitUntil: "domcontentloaded", timeout: 45_000 });

  // Si la sesión persiste, SECOP redirige automáticamente lejos del login en 2-25s.
  // Esperamos hasta 20s a que esa redirección ocurra; si no, necesitamos hacer login manual.
  const seSalio = await page
    .waitForURL((url) => !url.toString().includes("/STS/Users/Login"), { timeout: 20_000 })
    .then(() => true)
    .catch(() => false);

  if (seSalio) {
    console.log("Sesión ya activa (perfil persistente) — no fue necesario volver a loguearse.");
    return contexto;
  }

  try {
    await page.fill(SELECTOR_USUARIO, usuario, { timeout: 10_000 });
    await page.fill(SELECTOR_PASSWORD, password, { timeout: 10_000 });
    await page.click(SELECTOR_BOTON_LOGIN, { timeout: 10_000 });
  } catch (err) {
    // Si durante el fill el redirect ocurrió, la URL ya no es login → sesión válida
    const fueraDLogin = await page
      .waitForURL((url) => !url.toString().includes("/STS/Users/Login"), { timeout: 10_000 })
      .then(() => true)
      .catch(() => false);
    if (fueraDLogin) {
      console.log("El auto-redirect interrumpió el fill — sesión activa detectada.");
      return contexto;
    }
    throw err;
  }

  // El captcha solo aparece a veces (confirmado con el cliente: una vez por sesión, o tras
  // inactividad) — nunca lo resuelve el script, solo detecta si está presente y pausa.
  const captchaVisible = await page
    .locator(SELECTOR_CAPTCHA_TEXTO)
    .isVisible({ timeout: 5000 })
    .catch(() => false);

  if (captchaVisible) {
    await esperarConfirmacionHumana(
      "Apareció el captcha. Resuélvelo directamente en la ventana de Chrome (escribe el código y haz clic en Verificar/Sign In)."
    );
  }

  await page
    .waitForURL((url) => !url.toString().includes("/STS/Users/Login"), { timeout: 120_000 })
    .catch(() => {
      console.warn(
        "No se detectó salida de la página de login todavía — verifica manualmente en la ventana de Chrome si el login fue exitoso."
      );
    });

  console.log("Sesión iniciada (o lista para continuar manualmente en la ventana de Chrome).");
  return contexto;
}

const empresaArg = process.argv[2] ?? "VERDE_ECOLOGICO";
const nitArg = process.argv[3] ?? "900000001-1";

if (process.argv[1]?.endsWith("iniciarSesion.ts") || process.argv[1]?.endsWith("iniciarSesion.js")) {
  iniciarSesion({ nombreEnv: empresaArg, nit: nitArg }).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
