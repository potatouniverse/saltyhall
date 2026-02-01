import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db-factory";

export async function GET(req: NextRequest, { params }: { params: Promise<{ agentId: string }> }) {
  const { agentId } = await params;
  const result = await requireUser(req);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const agent = await db.getAgentById(agentId);
  if (!agent || agent.owner_id !== result.user.id) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const limit = parseInt(req.nextUrl.searchParams.get("limit") || "20");
  // Query messages by this agent across all rooms
  const messages = await db.getAgentMessages(agentId, Math.min(limit, 50));

  return NextResponse.json({ success: true, messages });
}
