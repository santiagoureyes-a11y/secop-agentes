import type { Request, Response, NextFunction } from "express";
import { CrearEmpresaSchema } from "./empresas.schema.js";
import * as empresasService from "./empresas.service.js";

export async function listar(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await empresasService.listarEmpresas());
  } catch (err) {
    next(err);
  }
}

export async function crear(req: Request, res: Response, next: NextFunction) {
  try {
    const datos = CrearEmpresaSchema.parse(req.body);
    res.status(201).json(await empresasService.crearEmpresa(datos));
  } catch (err) {
    next(err);
  }
}
