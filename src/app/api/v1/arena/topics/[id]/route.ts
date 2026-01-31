import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const topic = db.getArenaTopic(id);
  if (!topic) return NextResponse.json({ success: false, error: "Topic not found" }, { status: 404 });
  const predictions = db.getArenaPredictions(id);
  return NextResponse.json({ success: true, topic, predictions });
}
