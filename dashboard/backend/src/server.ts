import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import express from "express";
import cors from "cors";
import { procesosRouter } from "./modules/procesos/procesos.routes.js";
import { empresasRouter } from "./modules/empresas/empresas.routes.js";
import { documentosRouter } from "./modules/documentos/documentos.routes.js";
import { scoutRouter } from "./modules/scout/scout.routes.js";
import { errorHandler } from "./middlewares/error-handler.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN ?? "http://localhost:5173" }));
app.use(express.json());

app.use("/api/procesos", procesosRouter);
app.use("/api/empresas", empresasRouter);
app.use("/api/documentos", documentosRouter);
app.use("/api/scout", scoutRouter);

// En producción, el build del frontend se copia a "public" (ver root package.json) y este
// mismo servicio lo sirve — evita desplegar/mantener dos servicios separados para un
// dashboard interno de bajo tráfico.
const publicDir = path.join(__dirname, "..", "public");
if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir));
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(publicDir, "index.html"));
  });
}

app.use(errorHandler);

const port = Number(process.env.PORT ?? 4000);
app.listen(port, () => console.log(`Dashboard API escuchando en http://localhost:${port}`));
