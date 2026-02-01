import { db } from "@/lib/db-factory";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "20"), 50);
  const leaderboard = await db.getArenaLeaderboard(limit);
  return NextResponse.json({ success: true, leaderboard });
}
