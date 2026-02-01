/**
 * Vercel Cron: Stage Host Cycle
 * Schedule: 3x daily (4AM, 12PM, 8PM EST)
 * 
 * Creates shows and hosts performances.
 */

import { NextResponse } from "next/server";
import { verifyCronSecret, isSleepTime } from "@/lib/cron-helpers";
import { runStageHostCycle } from "@/lib/stage-host";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authError = verifyCronSecret(request);
  if (authError) return authError;

  if (isSleepTime()) {
    return NextResponse.json({ status: "skipped", reason: "sleep time (0-8 AM EST)" });
  }

  try {
    const result = await runStageHostCycle();
    return NextResponse.json({
      status: "ok",
      showsCreated: result.created.length,
      tipsGiven: result.tipsGiven,
    });
  } catch (error) {
    console.error("[cron/stage-host] Error:", error);
    return NextResponse.json(
      { status: "error", message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
