/**
 * Next.js instrumentation hook — runs once at server startup. Registers
 * OpenTelemetry (traces propagate to the AI plane via the forwarded request)
 * and, on the Node runtime, optional Sentry.
 */
export async function register() {
  const { registerOTel } = await import("@vercel/otel");
  registerOTel({ serviceName: process.env.OTEL_SERVICE_NAME ?? "vayu-web" });

  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.SENTRY_DSN) {
    const Sentry = await import("@sentry/node");
    Sentry.init({ dsn: process.env.SENTRY_DSN, tracesSampleRate: 0.1 });
  }
}
