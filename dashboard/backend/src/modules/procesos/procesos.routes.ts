import { Router } from "express";
import * as procesosController from "./procesos.controller.js";

export const procesosRouter = Router();

procesosRouter.get("/", procesosController.listar);
procesosRouter.get("/:id", procesosController.obtener);
procesosRouter.post("/", procesosController.crear);
procesosRouter.patch("/:id/estado", procesosController.actualizarEstado);
procesosRouter.patch("/:id/recomendacion-financiera", procesosController.guardarRecomendacionFinanciera);
procesosRouter.delete("/:id", procesosController.eliminar);
