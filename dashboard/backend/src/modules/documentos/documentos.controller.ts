import type { Request, Response, NextFunction } from "express";
import { ActualizarEstadoDocumentoSchema, CrearDocumentoSchema } from "./documentos.schema.js";
import * as documentosService from "./documentos.service.js";

export async function listarPorProceso(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await documentosService.listarDocumentosDeProceso(req.params.procesoId));
  } catch (err) {
    next(err);
  }
}

export async function crear(req: Request, res: Response, next: NextFunction) {
  try {
    const datos = CrearDocumentoSchema.parse(req.body);
    res.status(201).json(await documentosService.crearDocumento(datos));
  } catch (err) {
    next(err);
  }
}

export async function actualizarEstado(req: Request, res: Response, next: NextFunction) {
  try {
    const datos = ActualizarEstadoDocumentoSchema.parse(req.body);
    res.json(await documentosService.actualizarEstadoDocumento(req.params.id, datos));
  } catch (err) {
    next(err);
  }
}
