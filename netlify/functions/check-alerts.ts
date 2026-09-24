import { PrismaClient } from "@prisma/client";
import { timingSafeEqual } from "crypto";
import { runAlertCheck } from "../../src/lib/alert-checker";

// ────────────────────────────────────────────────────────────────────────────
// On-demand background function for alert checking.
//
// Previously this was a Netlify scheduled function (`schedule = "*/5 * * * *"`
// in netlify.toml). That approach had two problems:
//   1. Netlify's scheduler had noticeable jitter (a 14:30 tick could fire at
//      14:31:06), which the look-back window in alert-checker.ts now absorbs.
//   2. More importantly, Netlify's scheduled functions are a Netlify-specific
//      extension — they can't be tested locally and they tie us to Netlify's
//      scheduler.
//
// Now this is a STANDARD Netlify Function that responds to normal HTTP
// requests. The schedule is driven by a GitHub Actions workflow
// (`.github/workflows/cron.yml`) that runs every 5 minutes and `curl`s this
// endpoint. Benefits:
//   • Standard HTTP — testable locally with `netlify dev` or `curl`
//   • Scheduling owned in version-controlled YAML, not Netlify config
//   • Easy to swap the scheduler (cron-job.org, Vercel Cron, etc.) later
//   • The alert-check logic is unchanged (shared via src/lib/alert-checker.ts)
//
// ── Security ──────────────────────────────────────────────────────────────
// The endpoint is secured with a shared secret. Callers must pass the secret
// either:
//   • as an `x-api-key` header, OR
//   • as a `?key=` query parameter (use the header in production; the query
//     param exists for convenience in browsers/curl debugging)
//
// The expected value is read from `process.env.CRON_SECRET` (set in the
// Netlify dashboard). If `CRON_SECRET` is not configured, every request is
// rejected with 401 — fail-closed so a misconfigured deployment can't be
// abused by random internet traffic.
//
// A constant-time string comparison (`crypto.timingSafeEqual`) is used so
// the secret can't be recovered via timing attacks.
// ────────────────────────────────────────────────────────────────────────────

const db = new PrismaClient();

interface NetlifyEvent {
  httpMethod?: string;
  headers?: Record<string, string | undefined>;
  queryStringParameters?: Record<string, string | undefined>;
}

interface NetlifyResponse {
  statusCode: number;
  body: string;
  headers?: Record<string, string>;
}

// Constant-time string comparison to prevent timing attacks on the secret.
// Falls back to a plain `===` comparison if the lengths differ (which would
// throw in `timingSafeEqual`).
function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    const aBuf = Buffer.from(a);
    const bBuf = Buffer.from(b);
    return timingSafeEqual(aBuf, bBuf);
  } catch {
    return a === b;
  }
}

function authorize(event: NetlifyEvent): { ok: boolean; reason?: string } {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return { ok: false, reason: "CRON_SECRET not configured on the server" };
  }

  // Header lookup is case-insensitive — Netlify lowercases header names.
  const headerKey = event.headers?.["x-api-key"];
  const queryKey = event.queryStringParameters?.["key"];

  const provided = headerKey || queryKey;
  if (!provided) {
    return { ok: false, reason: "Missing x-api-key header (or ?key= query param)" };
  }

  if (!safeCompare(provided, expected)) {
    return { ok: false, reason: "Invalid API key" };
  }
  return { ok: true };
}

function json(statusCode: number, body: unknown): NetlifyResponse {
  return {
    statusCode,
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  };
}

export const handler = async (event: NetlifyEvent = {}): Promise<NetlifyResponse> => {
  const method = (event.httpMethod || "GET").toUpperCase();

  // Accept both GET (simple curl trigger from GitHub Actions) and POST (if
  // someone wants to POST a body in the future). Both require the secret.
  if (method !== "GET" && method !== "POST") {
    return json(405, { error: "Method not allowed — use GET or POST" });
  }

  const auth = authorize(event);
  if (!auth.ok) {
    // 401 (not 403) so it's clear the request lacked valid credentials.
    // Log the reason server-side but don't echo it back to the caller —
    // "Unauthorized" is enough info for an attacker.
    console.warn(`[check-alerts] Unauthorized: ${auth.reason}`);
    return json(401, { error: "Unauthorized" });
  }

  try {
    console.log(`[check-alerts] Authorized ${method} request — running alert check`);
    const result = await runAlertCheck({ db });
    console.log(`[check-alerts] Complete: sent=${result.sent} pending=${result.pending} subs=${result.subs}`);
    return json(200, result);
  } catch (e) {
    console.error(`[check-alerts] Fatal error:`, e);
    return json(500, {
      error: "Alert check failed",
      detail: e instanceof Error ? e.message : String(e),
    });
  }
};
