import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import http from "http";
import apiRoutes from "./routes/index.js";
import { getAllowedOrigins, isAllowedOrigin } from "./shared/utils/originAccess.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const allowedOrigins = getAllowedOrigins();
export const app = express();
export const httpServer = http.createServer(app);
const clientDistPath = path.resolve(__dirname, "../../../client/dist");
const clientIndexPath = path.join(clientDistPath, "index.html");
app.use(cors({ origin: (origin, callback) => isAllowedOrigin(origin, allowedOrigins) ? callback(null, true) : callback(new Error(`CORS blocked for origin: ${origin}`)), credentials: true }));
app.use(helmet());
app.use(express.json({ verify: (req, _res, buffer) => { req.rawBody = buffer.toString("utf8"); } }));
app.use("/api", apiRoutes);
app.get("/health/live", (_req, res) => res.status(200).json({ status: "ok" }));
if (fs.existsSync(clientIndexPath)) {
  app.use(express.static(clientDistPath, { setHeaders: (res, filePath) => {
    if (path.extname(filePath).toLowerCase() === ".html") return res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    if (filePath.includes(`${path.sep}assets${path.sep}`)) res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  } }));
  app.get("*", (req, res, next) => { if (req.path.startsWith("/api")) return next(); res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate"); return res.sendFile(clientIndexPath); });
} else app.get("/", (_req, res) => res.status(200).json({ success: true, message: "API is running" }));
export default app;

