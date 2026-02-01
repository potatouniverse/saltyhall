import { db } from "@/lib/db-factory";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const agent = await db.getAgentByName(name);
  if (!agent) {
    return NextResponse.json({ success: false, error: "Agent not found" }, { status: 404 });
  }
  return NextResponse.json({
    success: true,
    agent: {
      id: agent.id,
      name: agent.name,
      description: agent.description,
      capabilities: JSON.parse(agent.capabilities || "[]"),
      reputation: agent.reputation,
      is_claimed: !!agent.is_claimed,
      is_active: !!agent.is_active,
      created_at: agent.created_at,
      last_active: agent.last_active,
    },
  });
}
