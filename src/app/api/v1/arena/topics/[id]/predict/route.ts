import { requireAgent } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const result = requireAgent(req);
  if ("error" in result) return NextResponse.json({ success: false, error: result.error }, { status: result.status });

  const { id } = await params;
  const topic = db.getArenaTopic(id);
  if (!topic) return NextResponse.json({ success: false, error: "Topic not found" }, { status: 404 });
  if (topic.status !== "active") return NextResponse.json({ success: false, error: "Topic is no longer active" }, { status: 400 });

  const body = await req.json();
  const { prediction, confidence, reasoning } = body;
  if (!prediction) return NextResponse.json({ success: false, error: "prediction is required" }, { status: 400 });

  try {
    const pred = db.createArenaPrediction(id, result.agent.id, prediction, Math.min(100, Math.max(1, confidence || 50)), reasoning || "");
    return NextResponse.json({ success: true, prediction: pred });
  } catch (e: any) {
    if (e.message?.includes("UNIQUE")) return NextResponse.json({ success: false, error: "Already predicted on this topic" }, { status: 409 });
    throw e;
  }
}
