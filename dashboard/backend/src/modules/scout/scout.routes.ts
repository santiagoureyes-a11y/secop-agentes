import { Router } from "express";
import * as scoutController from "./scout.controller.js";

export const scoutRouter = Router();

scoutRouter.post("/ejecutar", scoutController.ejecutar);
