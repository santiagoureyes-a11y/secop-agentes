import path from "node:path";
import os from "node:os";
import { chromium, type BrowserContext } from "playwright";
import type { EmpresaSesion } from "./tipos.js";

const SECOP_LOGIN_URL = "https://community.secop.gov.co/STS/Users/Login/Index";

function carpetaDocumentosEmpresa(nit: string): string {
  return path.join(os.homedir(), "secop-documentos", nit);
}

function carpetaPerfilChrome(nit: string): string {
  return path.join(carpetaDocumentosEmpresa(nit), "sesion-chrome");
}

function credenciales(empresa: EmpresaSesion): { usuario: string; password: string } {
  const usuario = process.env[`SECOP_${empresa.nombreEnv}_USER`];
  const password = process.env[`SECOP_${empresa.nombreEnv}_PASS`];
  if (!usuario || !password) {
    throw new Error(
      `Faltan SECOP_${empresa.nombreEnv}_USER / SECOP_${empresa.nombreEnv}_PASS en .env`
    );
  }
  return { usuario, password };
}

// Perfil de Chrome persistente por empresa: las cookies/sesión quedan guardadas en disco
// (fuera del repo, junto a los documentos de esa empresa), así si el captcha es por sesión
// (confirmado con el cliente) no hay que resolverlo cada vez que se corre un script nuevo.
export async function abrirContextoPersistente(empresa: EmpresaSesion): Promise<BrowserContext> {
  const userDataDir = carpetaPerfilChrome(empresa.nit);
  return chromium.launchPersistentContext(userDataDir, {
    headless: false,
    viewport: { width: 1280, height: 900},
  });
}

export { SECOP_LOGIN_URL, credenciales };
