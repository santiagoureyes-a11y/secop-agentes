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

  await page.goto(SECOP_LOGIN_URL);

  // Si la cookie de sesión sigue vigente, SECOP la valida en segundo plano y redirige
  // automáticamente lejos del login — pero el retraso es variable (de ~2s a 25s+, confirmado
  // empíricamente) e independiente de cuándo intentemos llenar el formulario. En vez de
  // adivinar el tiempo exacto, se intenta llenar y si el auto-redirect interrumpe a mitad de
  // camino (elemento desmontado), se interpreta como "ya estaba logueado" en vez de fallar.
  const yaLogueadoAlEntrar = !page.url().includes("/STS/Users/Login");
  if (yaLogueadoAlEntrar) {
    console.log("Sesión ya activa (perfil persistente) — no fue necesario volver a loguearse.");
    return contexto;
  }

  try {
    await page.fill(SELECTOR_USUARIO, usuario, { timeout: 15_000 });
    await page.fill(SELECTOR_PASSWORD, password, { timeout: 15_000 });
    await page.click(SELECTOR_BOTON_LOGIN, { timeout: 15_000 });
  } catch (err) {
    if (!page.url().includes("/STS/Users/Login")) {
      console.log(
        "El auto-redirect de sesión interrumpió el llenado del formulario, pero ya estamos fuera del login — se interpreta como sesión válida."
      );
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
