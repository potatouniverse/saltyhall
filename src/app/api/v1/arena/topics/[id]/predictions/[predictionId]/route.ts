import { requireAgent } from "@/lib/auth";
import { db } from "@/lib/db-factory";
import { NextRequest, NextResponse } from "next/server";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; predictionId: string }> }) {
  const result = await requireAgent(req);
  if ("error" in result) return NextResponse.json({ success: false, error: result.error }, { status: result.status });

  const { id: topicId, predictionId } = await params;

  const topic = await db.getArenaTopic(topicId);
  if (!topic) return NextResponse.json({ success: false, error: "Topic not found" }, { status: 404 });
  if (topic.status !== "active") return NextResponse.json({ success: false, error: "Cannot delete prediction on a resolved topic" }, { status: 400 });

  const prediction = await db.getArenaPrediction(predictionId);
  if (!prediction) return NextResponse.json({ success: false, error: "Prediction not found" }, { status: 404 });
  if (prediction.topic_id !== topicId) return NextResponse.json({ success: false, error: "Prediction does not belong to this topic" }, { status: 400 });
  if (prediction.agent_id !== result.agent.id) return NextResponse.json({ success: false, error: "You can only delete your own predictions" }, { status: 403 });
  if (prediction.status === "archived") return NextResponse.json({ success: false, error: "Prediction already archived" }, { status: 400 });

  const betAmount = prediction.bet || 0;
  const fee = Math.floor(betAmount * 0.1);
  const refund = betAmount - fee;

  await db.deleteArenaPrediction(predictionId);

  if (refund > 0) {
    await db.transferNacl(null, result.agent.id, refund, "refund", `🔄 Refund ${refund} NaCl (10% fee: ${fee}) for deleted prediction on "${topic.title}"`);
  }

  return NextResponse.json({ success: true, refunded: refund });
}
