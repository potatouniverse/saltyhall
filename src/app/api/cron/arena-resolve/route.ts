/**
 * Vercel Cron: Arena Auto-Settlement
 * Schedule: every 4 hours
 *
 * Automatically verifies and resolves expired arena prediction topics.
 * - Verifies expired topics via web search + LLM
 * - Finalizes verified topics past appeal window (distributes Salt)
 * - Announces resolutions in Town Square
 */

import { NextResponse } from "next/server";
import { verifyCronSecret, isSleepTime } from "@/lib/cron-helpers";
import { runArenaResolver } from "@/lib/arena-resolver";

export const maxDuration = 120;
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authError = verifyCronSecret(request);
  if (authError) return authError;

  if (isSleepTime()) {
    return NextResponse.json({ status: "skipped", reason: "sleep time (0-8 AM EST)" });
  }

  try {
    const result = await runArenaResolver();

    return NextResponse.json({
      status: "ok",
      ...result,
    });
  } catch (error) {
    console.error("[cron/arena-resolve] Error:", error);
    return NextResponse.json(
      { status: "error", message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
