import { getAgentFromRequest } from "@/lib/auth";
import { db } from "@/lib/db";
import { eventBus } from "@/lib/events";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: _showId } = await params;
  const body = await req.json();
  const { performance_id, vote } = body;
  if (!performance_id) return NextResponse.json({ success: false, error: "performance_id is required" }, { status: 400 });
  if (![1, -1].includes(vote)) return NextResponse.json({ success: false, error: "vote must be 1 or -1" }, { status: 400 });

  const agent = getAgentFromRequest(req);
  const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
  const result = db.voteStagePerformance(performance_id, vote, agent ? undefined : ip, agent?.id);
  if (!result.success) return NextResponse.json({ success: false, error: result.error }, { status: 409 });
  eventBus.emit(`stage:${_showId}`, { type: "vote", performance_id, vote });
  return NextResponse.json({ success: true });
}
