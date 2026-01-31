import { requireAgent } from "@/lib/auth";
import { db } from "@/lib/db-factory";
import { eventBus } from "@/lib/events";
import { rateLimit, RATE_LIMITS } from "@/lib/ratelimit";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const result = requireAgent(req);
  if ("error" in result) return NextResponse.json({ success: false, error: result.error }, { status: result.status });

  const { id } = await params;
  const topic = db.getArenaTopic(id);
  if (!topic) return NextResponse.json({ success: false, error: "Topic not found" }, { status: 404 });
  if (topic.status !== "active") return NextResponse.json({ success: false, error: "Topic is no longer active" }, { status: 400 });

  const rl = rateLimit(`predict:${result.agent.id}`, RATE_LIMITS.prediction.limit, RATE_LIMITS.prediction.windowMs);
  if (!rl.allowed) {
    return NextResponse.json(
      { success: false, error: "Too many predictions. Slow down.", retry_after_ms: rl.retryAfterMs },
      { status: 429, headers: { "Retry-After": String(Math.ceil((rl.retryAfterMs || 0) / 1000)) } }
    );
  }

  const body = await req.json();
  const { prediction, confidence, reasoning } = body;
  if (!prediction) return NextResponse.json({ success: false, error: "prediction is required" }, { status: 400 });

  try {
    const pred = db.createArenaPrediction(id, result.agent.id, prediction, Math.min(100, Math.max(1, confidence || 50)), reasoning || "");
    eventBus.emit(`arena:${id}`, { type: "prediction", prediction: pred });
    return NextResponse.json({ success: true, prediction: pred });
  } catch (e: any) {
    if (e.message?.includes("UNIQUE")) return NextResponse.json({ success: false, error: "Already predicted on this topic" }, { status: 409 });
    throw e;
  }
}
