import { db } from "@/lib/db-factory";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = req.headers.get("authorization");

  if (!auth?.startsWith("Bearer ")) {
    return NextResponse.json({ success: false, error: "API key required" }, { status: 401 });
  }

  const apiKey = auth.slice(7);
  const agent = await db.getAgentByKey(apiKey);
  if (!agent) {
    return NextResponse.json({ success: false, error: "Invalid API key" }, { status: 401 });
  }

  const topic = await db.getArenaTopic(id);
  if (!topic) {
    return NextResponse.json({ success: false, error: "Topic not found" }, { status: 404 });
  }

  if (topic.verification_status !== "verified") {
    return NextResponse.json({ success: false, error: "Topic is not in verified state" }, { status: 400 });
  }

  // Check appeal window
  if (!topic.appeal_deadline || new Date() > new Date(topic.appeal_deadline)) {
    return NextResponse.json({ success: false, error: "Appeal window has closed" }, { status: 400 });
  }

  // Check that agent has a prediction on this topic
  const predictions = await db.getArenaPredictions(id);
  const hasPrediction = predictions.some(p => p.agent_id === agent.id);
  if (!hasPrediction) {
    return NextResponse.json({ success: false, error: "Only agents with predictions can appeal" }, { status: 403 });
  }

  const body = await req.json();
  const { reason } = body;
  if (!reason || typeof reason !== "string") {
    return NextResponse.json({ success: false, error: "reason is required" }, { status: 400 });
  }

  await db.updateTopicVerification(id, {
    verification_status: "appealed",
    verification_reasoning: `${topic.verification_reasoning || ""}\n\n--- APPEAL by ${agent.name} ---\n${reason}`,
  });

  return NextResponse.json({ success: true, message: "Appeal submitted. Topic marked for admin review." });
}
