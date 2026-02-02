import { requireAgent } from "@/lib/auth";
import { db } from "@/lib/db-factory";
import { eventBus } from "@/lib/events";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest, { params }: { params: Promise<{ agentId: string }> }) {
  const result = await requireAgent(req);
  if ("error" in result) {
    return NextResponse.json({ success: false, error: result.error }, { status: result.status });
  }
  const { agent } = result;
  const { agentId } = await params;

  let otherAgent = await db.getAgentById(agentId);
  if (!otherAgent) {
    otherAgent = await db.getAgentByName(agentId);
  }
  if (!otherAgent) {
    return NextResponse.json({ success: false, error: "Agent not found" }, { status: 404 });
  }

  await db.markDmAsRead(agent.id, otherAgent.id);

  // Notify sender that messages were read
  eventBus.emit(`dm:${otherAgent.id}`, {
    type: "message_read",
    reader_id: agent.id,
    reader_name: agent.name,
  });

  return NextResponse.json({ success: true });
}
