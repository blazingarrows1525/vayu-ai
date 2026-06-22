import pino from "pino";

/** Structured JSON logger for the product plane (server-side). */
export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  base: { service: process.env.OTEL_SERVICE_NAME ?? "vayu-web" },
});
