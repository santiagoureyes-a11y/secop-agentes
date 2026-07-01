import { prisma } from "../../config/prisma.js";
import type { z } from "zod";
import type { CrearEmpresaSchema } from "./empresas.schema.js";

type CrearEmpresaInput = z.infer<typeof CrearEmpresaSchema>;

export function listarEmpresas() {
  return prisma.empresa.findMany({ orderBy: { nombre: "asc" } });
}

export function crearEmpresa(datos: CrearEmpresaInput) {
  return prisma.empresa.upsert({
    where: { nit: datos.nit },
    update: datos,
    create: datos,
  });
}
