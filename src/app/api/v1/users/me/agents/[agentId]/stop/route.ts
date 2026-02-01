import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db-factory";
import { hostedEngine } from "@/lib/hosted-engine-init";

export async function POST(req: NextRequest, { params }: { params: Promise<{ agentId: string }> }) {
  const { agentId } = await params;
  const result = await requireUser(req);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const agent = await db.getAgentById(agentId);
  if (!agent || agent.owner_id !== result.user.id) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  if (!agent.is_hosted) {
    return NextResponse.json({ error: "Not a hosted agent" }, { status: 400 });
  }

  await db.updateAgent(agentId, { hosted_status: "stopped" });
  hostedEngine.unregisterAgent(agentId);

  return NextResponse.json({ success: true, hosted_status: "stopped" });
}
