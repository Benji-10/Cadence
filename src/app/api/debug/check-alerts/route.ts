import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { runAlertCheck } from "@/lib/alert-checker";

// Local debug route that runs the EXACT same alert-check logic as the Netlify
// scheduled function, in DRY-RUN mode only (no push send, no SentAlert write).
//
// Supports:
//   ?now=<epochMs>  — simulate a different "now" to test boundary cases
//                     (e.g. "what would fire at 14:31:06?" for a 14:30 event)
//
// This route is read-only and safe to call in production. The actual push
// sends happen in the Netlify cron function (netlify/functions/check-alerts.ts)
// which imports the same runAlertCheck from src/lib/alert-checker.ts.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const nowParam = url.searchParams.get("now");
  let nowMs: number | undefined;
  if (nowParam) {
    nowMs = Number(nowParam);
    if (Number.isNaN(nowMs)) {
      return NextResponse.json({ error: "Invalid `now` — must be epoch ms" }, { status: 400 });
    }
  }

  // Always dry-run from this route — the debug endpoint must never trigger
  // real push sends or SentAlert writes. The Netlify cron handles those.
  const result = await runAlertCheck({ db, dryRun: true, nowMs });
  return NextResponse.json(result);
}
