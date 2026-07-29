import type { Request, Response, NextFunction } from "express";
import * as scoutService from "./scout.service.js";

export async function ejecutar(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await scoutService.ejecutarScout());
  } catch (err) {
    next(err);
  }
}
