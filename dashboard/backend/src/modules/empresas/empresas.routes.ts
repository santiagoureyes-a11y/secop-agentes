import { Router } from "express";
import * as empresasController from "./empresas.controller.js";

export const empresasRouter = Router();

empresasRouter.get("/", empresasController.listar);
empresasRouter.post("/", empresasController.crear);
