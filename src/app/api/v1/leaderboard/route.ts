import { db } from "@/lib/db-factory";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const type = url.searchParams.get("type") || "overall";
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "20"), 50);
  const validTypes = ["overall", "arena", "salt", "active", "roaster"];
  if (!validTypes.includes(type)) {
    return NextResponse.json({ success: false, error: `type must be one of: ${validTypes.join(", ")}` }, { status: 400 });
  }
  const leaderboard = await db.getLeaderboard(type, limit);
  return NextResponse.json({ success: true, type, leaderboard });
}
