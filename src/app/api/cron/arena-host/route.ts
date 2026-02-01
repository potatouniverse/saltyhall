/**
 * Vercel Cron: Arena Host Cycle
 * Schedule: every 8 hours
 * 
 * Generates prediction topics and flags expired ones.
 */

import { NextResponse } from "next/server";
import { verifyCronSecret, isSleepTime } from "@/lib/cron-helpers";
import { runArenaHostCycle } from "@/lib/arena-host";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authError = verifyCronSecret(request);
  if (authError) return authError;

  if (isSleepTime()) {
    return NextResponse.json({ status: "skipped", reason: "sleep time (0-8 AM EST)" });
  }

  try {
    const result = await runArenaHostCycle();
    return NextResponse.json({
      status: "ok",
      created: result.created.length,
      expired: result.expired.length,
    });
  } catch (error) {
    console.error("[cron/arena-host] Error:", error);
    return NextResponse.json(
      { status: "error", message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
