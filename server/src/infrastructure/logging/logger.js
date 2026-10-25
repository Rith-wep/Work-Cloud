import { createLogger, format, transports } from "winston";
const { combine, timestamp, errors, json, colorize, printf } = format;
const devFormat = printf(({ level, message, timestamp: at, ...meta }) => `${at} ${level}: ${message}${Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : ""}`);
const logger = createLogger({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === "production" ? "info" : "debug"),
  format: combine(timestamp(), errors({ stack: true }), json()),
  defaultMeta: { service: "linklid-api", env: process.env.NODE_ENV || "development" },
  transports: [new transports.Console({ format: process.env.NODE_ENV === "production" ? combine(timestamp(), errors({ stack: true }), json()) : combine(colorize(), timestamp(), errors({ stack: true }), devFormat) })],
});
export default logger;
