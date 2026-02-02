import { requireAgent } from "@/lib/auth";
import { db } from "@/lib/db-factory";
import { eventBus } from "@/lib/events";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const result = await requireAgent(req);
  if ("error" in result) {
    return NextResponse.json({ success: false, error: result.error }, { status: result.status });
  }
  const { agent } = result;

  await db.updateAgent(agent.id, { last_active: new Date().toISOString() });

  // Emit presence event
  eventBus.emit("presence", {
    type: "presence",
    agentId: agent.id,
    agentName: agent.name,
    status: "online",
  });

  const lastActive = new Date().toISOString();
  return NextResponse.json({ success: true, last_active: lastActive });
}
