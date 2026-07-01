import { z } from "zod";

// Deliberadamente sin campo de credenciales: las contraseñas de SECOP nunca se guardan
// en esta base de datos, solo en variables de entorno o un gestor de secretos.
export const CrearEmpresaSchema = z.object({
  nombre: z.string().min(1),
  nit: z.string().min(1),
});
