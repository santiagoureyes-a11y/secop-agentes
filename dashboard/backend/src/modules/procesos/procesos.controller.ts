import type { Request, Response, NextFunction } from "express";
import multer from "multer";
import {
  ActualizarEstadoSchema,
  CrearProcesoSchema,
  FechaCierreSchema,
  RecomendacionFinancieraSchema,
} from "./procesos.schema.js";
import * as procesosService from "./procesos.service.js";

export const uploadMiddleware = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

export async function listar(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await procesosService.listarProcesos());
  } catch (err) {
    next(err);
  }
}

export async function obtener(req: Request, res: Response, next: NextFunction) {
  try {
    const proceso = await procesosService.obtenerProceso(req.params.id);
    if (!proceso) return res.status(404).json({ error: "Proceso no encontrado" });
    res.json(proceso);
  } catch (err) {
    next(err);
  }
}

export async function crear(req: Request, res: Response, next: NextFunction) {
  try {
    const datos = CrearProcesoSchema.parse(req.body);
    const resultado = await procesosService.crearProceso(datos);
    if (!resultado) return res.status(409).json({ error: "Proceso rechazado/descartado — se ignora" });
    res.status(201).json(resultado);
  } catch (err) {
    next(err);
  }
}

export async function actualizarEstado(req: Request, res: Response, next: NextFunction) {
  try {
    const datos = ActualizarEstadoSchema.parse(req.body);
    res.json(await procesosService.actualizarEstado(req.params.id, datos));
  } catch (err) {
    next(err);
  }
}

export async function eliminar(req: Request, res: Response, next: NextFunction) {
  try {
    await procesosService.eliminarProceso(req.params.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

export async function subirArchivo(req: Request, res: Response, next: NextFunction) {
  try {
    const proceso = await procesosService.obtenerProceso(req.params.id);
    if (!proceso) return res.status(404).json({ error: "Proceso no encontrado" });
    if (!req.file) return res.status(400).json({ error: "No se recibió ningún archivo" });
    await procesosService.guardarArchivoSubido(proceso.idProceso, req.file.originalname, req.file.buffer);
    res.status(201).json({ nombre: req.file.originalname });
  } catch (err) {
    next(err);
  }
}

export async function listarArchivos(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await procesosService.listarArchivosDescargados(req.params.id));
  } catch (err) {
    next(err);
  }
}

export async function servirArchivo(req: Request, res: Response, next: NextFunction) {
  try {
    const ruta = await procesosService.rutaArchivoDescargado(req.params.id, req.params.filename);
    if (!ruta) return res.status(404).json({ error: "Archivo no encontrado" });
    res.download(ruta, req.params.filename);
  } catch (err) {
    next(err);
  }
}

export async function depurar(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await procesosService.depurarProcesos());
  } catch (err) {
    next(err);
  }
}

export async function actualizarFechaCierre(req: Request, res: Response, next: NextFunction) {
  try {
    const datos = FechaCierreSchema.parse(req.body);
    res.json(await procesosService.actualizarFechaCierre(req.params.id, datos.fechaCierre));
  } catch (err) {
    next(err);
  }
}

export async function guardarRecomendacionFinanciera(req: Request, res: Response, next: NextFunction) {
  try {
    const datos = RecomendacionFinancieraSchema.parse(req.body);
    res.json(await procesosService.guardarRecomendacionFinanciera(req.params.id, datos));
  } catch (err) {
    next(err);
  }
}
