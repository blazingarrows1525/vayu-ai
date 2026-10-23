import { sql } from "drizzle-orm";
import { db } from "@vayu/db";
import { getServiceToken } from "./ai";

/**
 * Server-side health checks behind /status: every hop an AI feature depends on, each with the
 * concrete fix. Never exposes secrets — only hosts, provider names and short errors.
 */

export type CheckStatus = "ok" | "warn" | "fail";
export interface Check {
  id: string;
  label: string;
  status: CheckStatus;
  detail: string;
  fix?: string;
}

interface AiDiagnostics {
  llm: { configured: string[]; probe: { ok: boolean; provider?: string; model?: string; error?: string } | null };
  voice: { stt: string | null; tts: string | null };
  video: { provider: string | null };
  embeddings: { provider: string; model: string; available: boolean };
  ffmpeg: boolean;
  database: {
    ok: boolean;
    error?: string;
    tables?: Record<string, boolean>;
    pgvector?: boolean;
    embedding_column_dim?: number | null;
    embedding_dim_setting?: number;
  };
}

const LOCAL = /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:|\/|$)/;
const APP_TABLES = ["user", "account", "session", "verification", "jwks", "workspace", "conversation"];
const AI_TIMEOUT_MS = 90_000; // a sleeping Render free instance takes ~1 min to wake

export function siteOrigin(): string {
  for (const candidate of [
    process.env.BETTER_AUTH_URL,
    process.env.RENDER_EXTERNAL_URL,
    process.env.NEXT_PUBLIC_APP_URL,
  ]) {
    try {
      if (candidate) return new URL(candidate).origin;
    } catch {
      // ignore malformed values
    }
  }
  return "http://localhost:3000";
}

function errorText(err: unknown): string {
  const e = err as { name?: string; message?: string; cause?: { code?: string; message?: string } };
  if (e?.name === "TimeoutError") return "timed out";
  return (e?.cause?.code ?? e?.cause?.message ?? e?.message ?? String(err)).slice(0, 240);
}

async function databaseCheck(): Promise<Check> {
  try {
    const rows = await db.execute(
      sql.raw(
        `select ${APP_TABLES.map((t) => `to_regclass('public."${t}"') is not null as "${t}"`).join(", ")}`,
      ),
    );
    const present = (rows as unknown as Record<string, boolean>[])[0] ?? {};
    const missing = APP_TABLES.filter((t) => !present[t]);
    return missing.length
      ? {
          id: "web-db",
          label: "App database",
          status: "fail",
          detail: `Missing tables: ${missing.join(", ")}.`,
          fix: "Deploy the latest commit on vayu-web — it creates its tables on startup (look for “[migrate]” in its logs).",
        }
      : { id: "web-db", label: "App database", status: "ok", detail: "All app tables are present." };
  } catch (err) {
    return {
      id: "web-db",
      label: "App database",
      status: "fail",
      detail: `Cannot query the database: ${errorText(err)}`,
      fix: "Check DATABASE_URL on vayu-web points at your Render Postgres.",
    };
  }
}

export async function runDiagnostics(): Promise<{ site: string; checks: Check[] }> {
  const site = siteOrigin();
  const deployed = !LOCAL.test(site);
  const checks: Check[] = [await databaseCheck()];
  const blocked = (id: string, label: string, by: string): Check => ({
    id,
    label,
    status: "fail",
    detail: `Not checked — fix “${by}” first.`,
  });

  // ── web → AI wiring ───────────────────────────────────────────────
  const ai = process.env.AI_SERVICE_URL?.replace(/\/+$/, "");
  const aiFix =
    "Render → vayu-web → Environment → set AI_SERVICE_URL to your vayu-ai address, e.g. https://vayu-ai-xxxx.onrender.com (copy it from the vayu-ai service page).";
  if (!ai || (deployed && LOCAL.test(ai))) {
    checks.push({
      id: "ai-url",
      label: "AI service address",
      status: "fail",
      detail: ai
        ? `AI_SERVICE_URL is ${ai} — that only works on a laptop, not on Render.`
        : "AI_SERVICE_URL is not set, so every AI feature calls localhost and fails.",
      fix: aiFix,
    });
    for (const [id, label] of [
      ["ai-up", "AI service reachable"],
      ["ai-auth", "AI accepts your login"],
    ] as const)
      checks.push(blocked(id, label, "AI service address"));
    return { site, checks };
  }
  checks.push({ id: "ai-url", label: "AI service address", status: "ok", detail: ai });

  const started = Date.now();
  try {
    const res = await fetch(`${ai}/v1/health`, { cache: "no-store", signal: AbortSignal.timeout(AI_TIMEOUT_MS) });
    const ms = Date.now() - started;
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    checks.push({
      id: "ai-up",
      label: "AI service reachable",
      status: ms > 20_000 ? "warn" : "ok",
      detail:
        ms > 20_000
          ? `Answered after ${Math.round(ms / 1000)}s — it was asleep. Render free instances sleep after ~15 min idle, so the first request after a break is slow.`
          : `Answered in ${ms} ms.`,
    });
  } catch (err) {
    checks.push({
      id: "ai-up",
      label: "AI service reachable",
      status: "fail",
      detail: `${ai}/v1/health → ${errorText(err)}`,
      fix: "Make sure vayu-ai shows “Live” in Render, and that AI_SERVICE_URL is its exact https address.",
    });
    checks.push(blocked("ai-auth", "AI accepts your login", "AI service reachable"));
    return { site, checks };
  }

  let token: string | null = null;
  try {
    token = await getServiceToken();
  } catch (err) {
    checks.push({
      id: "ai-auth",
      label: "AI accepts your login",
      status: "fail",
      detail: `Could not create a login token: ${errorText(err)}`,
      fix: "If BETTER_AUTH_SECRET on vayu-web was changed, the stored signing key no longer decrypts — delete the rows in the jwks table and retry.",
    });
    return { site, checks };
  }

  let d: AiDiagnostics;
  try {
    const res = await fetch(`${ai}/v1/diagnostics?probe=1`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(AI_TIMEOUT_MS),
    });
    if (res.status === 401 || res.status === 403) {
      checks.push({
        id: "ai-auth",
        label: "AI accepts your login",
        status: "fail",
        detail: `vayu-ai rejected your login token (HTTP ${res.status}), so every AI feature is refused.`,
        fix: `Render → vayu-ai → Environment → set AUTH_JWKS_URL = ${site}/api/auth/jwks (and AUTH_JWT_ISSUER = vayu, AUTH_JWT_AUDIENCE = vayu-ai).`,
      });
      return { site, checks };
    }
    if (res.status === 404) {
      checks.push({
        id: "ai-auth",
        label: "AI accepts your login",
        status: "fail",
        detail: "vayu-ai is running an older version without the self-check.",
        fix: "Render → vayu-ai → Manual Deploy → Deploy latest commit.",
      });
      return { site, checks };
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 160)}`);
    d = (await res.json()) as AiDiagnostics;
  } catch (err) {
    checks.push({
      id: "ai-auth",
      label: "AI accepts your login",
      status: "fail",
      detail: `Self-check failed: ${errorText(err)}`,
      fix: "Open vayu-ai → Logs in Render for the error.",
    });
    return { site, checks };
  }
  checks.push({ id: "ai-auth", label: "AI accepts your login", status: "ok", detail: "Your login token is verified by vayu-ai." });

  // ── what the AI service can do ────────────────────────────────────
  const keyFix =
    "Render → vayu-ai → Environment → set GEMINI_API_KEY (from Google AI Studio → Get API key). One Gemini key powers chat, voice, video and search.";
  const probe = d.llm.probe;
  checks.push(
    probe?.ok
      ? { id: "llm", label: "AI model (chat, research, agents)", status: "ok", detail: `${probe.provider} · ${probe.model}` }
      : {
          id: "llm",
          label: "AI model (chat, research, agents)",
          status: "fail",
          detail: d.llm.configured.length
            ? `Keys set for ${d.llm.configured.join(", ")}, but a test call failed: ${probe?.error ?? "unknown error"}`
            : "No model API key is set on vayu-ai.",
          fix: d.llm.configured.includes("gemini")
            ? "GEMINI_API_KEY is set but was rejected — check it in Google AI Studio → API keys (copy it again, without spaces)."
            : keyFix,
        },
  );
  checks.push(
    d.voice.stt
      ? { id: "stt", label: "Voice input (speech-to-text)", status: "ok", detail: `via ${d.voice.stt}` }
      : { id: "stt", label: "Voice input (speech-to-text)", status: "fail", detail: "No speech-to-text provider configured.", fix: keyFix },
  );
  checks.push(
    d.voice.tts
      ? { id: "tts", label: "Spoken replies (text-to-speech)", status: "ok", detail: `via ${d.voice.tts}` }
      : { id: "tts", label: "Spoken replies (text-to-speech)", status: "warn", detail: "Replies are text-only.", fix: keyFix },
  );
  checks.push(
    !d.video.provider
      ? { id: "video", label: "Video summaries", status: "fail", detail: "No vision model configured.", fix: keyFix }
      : !d.ffmpeg
        ? { id: "video", label: "Video summaries", status: "fail", detail: "ffmpeg is missing from the AI container.", fix: "Deploy vayu-ai from infra/docker/Dockerfile.ai (it installs ffmpeg)." }
        : { id: "video", label: "Video summaries", status: "ok", detail: `via ${d.video.provider}` },
  );
  checks.push(
    d.embeddings.available
      ? { id: "embeddings", label: "Knowledge base search", status: "ok", detail: `${d.embeddings.provider} · ${d.embeddings.model}` }
      : {
          id: "embeddings",
          label: "Knowledge base search",
          status: "warn",
          detail: `No key for the ${d.embeddings.provider} embedding provider — uploads are saved but not searchable.`,
          fix: keyFix,
        },
  );

  const adb = d.database;
  if (adb.ok) {
    checks.push({ id: "ai-db", label: "AI database", status: "ok", detail: "Tables, pgvector and vector size all match." });
  } else {
    const problems: string[] = [];
    if (adb.error) problems.push(adb.error);
    const missing = Object.entries(adb.tables ?? {}).filter(([, ok]) => !ok).map(([t]) => t);
    if (missing.length) problems.push(`missing tables: ${missing.join(", ")}`);
    if (adb.pgvector === false) problems.push("pgvector extension not installed");
    if (adb.embedding_column_dim != null && adb.embedding_column_dim !== adb.embedding_dim_setting)
      problems.push(`vector column is ${adb.embedding_column_dim}-d but EMBEDDING_DIM is ${adb.embedding_dim_setting}`);
    checks.push({
      id: "ai-db",
      label: "AI database",
      status: "fail",
      detail: problems.join("; ") || "Schema check failed.",
      fix: "Deploy the latest commit on vayu-ai — it migrates on startup (look for “Running upgrade” or “[migrate]” in its logs).",
    });
  }

  const live = (process.env.AI_PUBLIC_URL || ai).replace(/\/+$/, "");
  checks.push(
    deployed && !live.startsWith("https://")
      ? {
          id: "live",
          label: "VAYU Live connection",
          status: "fail",
          detail: `Browsers would connect to ${live}, which isn't a public https address.`,
          fix: "Set AI_PUBLIC_URL on vayu-web to the public https address of vayu-ai.",
        }
      : { id: "live", label: "VAYU Live connection", status: "ok", detail: live.replace(/^http/, "ws") + "/v1/ws/chat" },
  );

  return { site, checks };
}
