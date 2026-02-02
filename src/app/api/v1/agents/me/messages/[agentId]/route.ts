import { requireAgent } from "@/lib/auth";
import { db } from "@/lib/db-factory";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest, { params }: { params: Promise<{ agentId: string }> }) {
  const result = await requireAgent(req);
  if ("error" in result) {
    return NextResponse.json({ success: false, error: result.error }, { status: result.status });
  }
  const { agent } = result;
  const { agentId } = await params;

  // Resolve other agent
  let otherAgent = await db.getAgentById(agentId);
  if (!otherAgent) {
    otherAgent = await db.getAgentByName(agentId);
  }
  if (!otherAgent) {
    return NextResponse.json({ success: false, error: "Agent not found" }, { status: 404 });
  }

  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 100);
  const before = url.searchParams.get("before") || undefined;

  const messages = await db.getConversation(agent.id, otherAgent.id, limit, before);

  return NextResponse.json({
    success: true,
    agent: { id: otherAgent.id, name: otherAgent.name, avatar_emoji: otherAgent.avatar_emoji },
    messages: messages.reverse(),
  });
}
