import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import type { Page } from "playwright";

export interface DocumentoListado {
  nombre: string;
  documentFileId: string;
  mkey: string;
}

// Lee la grilla de documentos de la página del proceso (ya autenticada) y extrae, para cada
// fila, el documentFileId + mkey embebidos en el onclick del link "Descargar" — son la forma
// real (verificada en vivo) en que SECOP expone la descarga, sin necesitar simular el clic JS.
export async function listarDocumentos(page: Page): Promise<DocumentoListado[]> {
  return page.evaluate(() => {
    const filas = Array.from(document.querySelectorAll("#grdGridDocumentList_tbl tr"));
    const resultado: { nombre: string; documentFileId: string; mkey: string }[] = [];
    for (const fila of filas) {
      const nombreEl = fila.querySelector('span[id*="spnDocumentName"]');
      const linkEl = fila.querySelector('a[id*="lnkDownloadLink"]');
      if (!nombreEl || !linkEl) continue;
      const onclick = linkEl.getAttribute("onclick") ?? "";
      const idMatch = onclick.match(/documentFileId=' \+ '(\d+)'/);
      const mkeyMatch = onclick.match(/mkey=([a-f0-9_]+)/);
      if (!idMatch || !mkeyMatch) continue;
      resultado.push({
        nombre: nombreEl.textContent?.trim() ?? "",
        documentFileId: idMatch[1],
        mkey: mkeyMatch[1],
      });
    }
    return resultado;
  });
}

export function carpetaDescargas(nit: string, idProceso: string): string {
  const dir = path.join(os.homedir(), "secop-documentos", nit, "descargados", idProceso);
  mkdirSync(dir, { recursive: true });
  return dir;
}

// Descarga un documento usando las cookies de la sesión ya autenticada (context.request
// comparte el cookie jar del browser context) — no hace falta simular el clic.
//
// DownloadFile no devuelve el archivo directamente: devuelve un pequeño stub JS con
// "window.location.href = '/Public/Archive/RetrieveFile/Index?DocumentId=...'" (verificado en
// vivo) — hay que seguir esa segunda URL para obtener el archivo real.
export async function descargarDocumento(
  page: Page,
  doc: DocumentoListado,
  nit: string,
  idProceso: string
): Promise<string> {
  const urlInicial = `https://community.secop.gov.co/Public/Tendering/OpportunityDetail/DownloadFile?documentFileId=${doc.documentFileId}&mkey=${doc.mkey}`;
  const primeraRespuesta = await page.context().request.get(urlInicial);
  if (!primeraRespuesta.ok()) {
    throw new Error(`No se pudo descargar ${doc.nombre}: HTTP ${primeraRespuesta.status()}`);
  }

  let buffer = await primeraRespuesta.body();
  const stub = buffer.toString("utf-8");
  const redirectMatch = stub.match(/window\.location\.href\s*=\s*'([^']+)'/);

  if (redirectMatch) {
    const urlReal = new URL(redirectMatch[1], "https://community.secop.gov.co").toString();
    const segundaRespuesta = await page.context().request.get(urlReal);
    if (!segundaRespuesta.ok()) {
      throw new Error(`No se pudo descargar ${doc.nombre} (redirect): HTTP ${segundaRespuesta.status()}`);
    }
    buffer = await segundaRespuesta.body();
  }

  const destino = path.join(carpetaDescargas(nit, idProceso), doc.nombre);
  writeFileSync(destino, buffer);
  return destino;
}
