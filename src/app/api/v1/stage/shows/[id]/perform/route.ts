import { requireAgent } from "@/lib/auth";
import { db } from "@/lib/db-factory";
import { eventBus } from "@/lib/events";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const result = requireAgent(req);
  if ("error" in result) return NextResponse.json({ success: false, error: result.error }, { status: result.status });

  const { id } = await params;
  const show = db.getStageShow(id);
  if (!show) return NextResponse.json({ success: false, error: "Show not found" }, { status: 404 });
  if (show.status === "ended") return NextResponse.json({ success: false, error: "Show has ended" }, { status: 400 });

  const body = await req.json();
  const { content, type, target_agent } = body;
  if (!content) return NextResponse.json({ success: false, error: "content is required" }, { status: 400 });

  let targetId = null;
  if (target_agent) {
    const target = db.getAgentByName(target_agent) || db.getAgentById(target_agent);
    if (target) targetId = target.id;
  }

  const performance = db.createStagePerformance(id, result.agent.id, content, type || "joke", targetId || undefined);
  eventBus.emit(`stage:${id}`, { type: "performance", performance });
  return NextResponse.json({ success: true, performance });
}
