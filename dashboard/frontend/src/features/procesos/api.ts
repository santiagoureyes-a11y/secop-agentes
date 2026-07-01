import type { EstadoProceso, Proceso } from "../../types/proceso";

// Vacío por defecto (rutas relativas) — en producción el frontend se sirve desde el mismo
// origen que la API. En desarrollo, .env define VITE_API_URL=http://localhost:4000.
const API_URL = import.meta.env.VITE_API_URL ?? "";

async function manejarRespuesta<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`Error ${res.status}: ${await res.text()}`);
  return res.json();
}

export function listarProcesos(): Promise<Proceso[]> {
  return fetch(`${API_URL}/api/procesos`).then(manejarRespuesta<Proceso[]>);
}

export function obtenerProceso(id: string): Promise<Proceso> {
  return fetch(`${API_URL}/api/procesos/${id}`).then(manejarRespuesta<Proceso>);
}

export function listarArchivosDescargados(id: string): Promise<{ nombre: string; url: string }[]> {
  return fetch(`${API_URL}/api/procesos/${id}/archivos`).then(manejarRespuesta);
}

export function urlArchivoDescargado(id: string, nombre: string): string {
  return `${API_URL}/api/procesos/${id}/archivos/${encodeURIComponent(nombre)}`;
}

export function actualizarEstadoProceso(id: string, estado: EstadoProceso): Promise<Proceso> {
  return fetch(`${API_URL}/api/procesos/${id}/estado`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ estado }),
  }).then(manejarRespuesta<Proceso>);
}
