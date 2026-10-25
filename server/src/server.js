import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
if (process.env.NODE_ENV !== "production") {
  dotenv.config({ path: path.resolve(__dirname, "../.env") });
}
import mongoose from "mongoose";
import connectDB from "./infrastructure/database/db.js";
import { app, allowedOrigins, httpServer } from "./app.js";
import { initializeSocket } from "./shared/socket/socketServer.js";
import logger from "./infrastructure/logging/logger.js";

const PORT = Number(process.env.PORT || 5000);
let shuttingDown = false;
const shutdown = async (signal) => {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info("Server shutdown requested", { signal });
  const forceTimer = setTimeout(() => process.exit(1), 10000);
  forceTimer.unref();
  httpServer.close(async (error) => {
    if (error) logger.error("HTTP server close failed", { message: error.message });
    try { await mongoose.disconnect(); } catch (disconnectError) { logger.error("MongoDB disconnect failed", { message: disconnectError.message }); }
    process.exit(error ? 1 : 0);
  });
};
const startServer = async () => {
  try {
    await connectDB();
    initializeSocket(httpServer, allowedOrigins);
    httpServer.listen(PORT, "0.0.0.0", () => logger.info("Server started", { port: PORT, localUrl: `http://localhost:${PORT}` }));
  } catch (error) {
    logger.error("Server startup failed", { message: error.message });
    process.exit(1);
  }
};
process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));
startServer();


