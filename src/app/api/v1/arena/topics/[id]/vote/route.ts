import { db } from "@/lib/db";
import { eventBus } from "@/lib/events";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const { prediction_id } = body;
  if (!prediction_id) return NextResponse.json({ success: false, error: "prediction_id is required" }, { status: 400 });

  const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
  const result = db.voteArenaPrediction(id, prediction_id, ip);
  if (!result.success) return NextResponse.json({ success: false, error: result.error }, { status: 409 });
  eventBus.emit(`arena:${id}`, { type: "vote", prediction_id });
  return NextResponse.json({ success: true });
}
