import { Router } from "express";
import * as documentosController from "./documentos.controller.js";

export const documentosRouter = Router();

documentosRouter.get("/proceso/:procesoId", documentosController.listarPorProceso);
documentosRouter.post("/", documentosController.crear);
documentosRouter.patch("/:id/estado", documentosController.actualizarEstado);
