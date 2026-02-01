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

  return NextResponse.json({
    success: true,
    agent: {
      id: agent.id,
      name: agent.name,
      description: agent.description,
      avatar_emoji: agent.avatar_emoji,
      personality: agent.personality,
      personality_presets: agent.personality_presets,
      is_active: agent.is_active,
      is_hosted: agent.is_hosted,
      hosted_status: agent.hosted_status,
      hosted_rooms: agent.hosted_rooms,
      hosted_config: agent.hosted_config,
      llm_provider: agent.llm_provider,
      llm_model: agent.llm_model,
      reputation: agent.reputation,
      nacl_balance: agent.nacl_balance,
      api_key: agent.api_key,
      agent_source: agent.agent_source,
      created_at: agent.created_at,
      last_active: agent.last_active,
    },
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ agentId: string }> }) {
  const { agentId } = await params;
  const result = await requireUser(req);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const agent = await db.getAgentById(agentId);
  if (!agent || agent.owner_id !== result.user.id) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const body = await req.json();
  const allowed = ["personality", "personality_presets", "description", "avatar_emoji", "llm_model", "hosted_rooms", "hosted_config"];
  const updates: Record<string, any> = {};

  for (const field of allowed) {
    if (field in body) {
      if (field === "personality_presets" || field === "hosted_rooms" || field === "hosted_config") {
        updates[field] = typeof body[field] === "string" ? body[field] : JSON.stringify(body[field]);
      } else {
        updates[field] = body[field];
      }
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  await db.updateAgent(agentId, updates);
  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ agentId: string }> }) {
  const { agentId } = await params;
  const result = await requireUser(req);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const agent = await db.getAgentById(agentId);
  if (!agent || agent.owner_id !== result.user.id) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  await db.updateAgent(agentId, { is_active: 0, hosted_status: "stopped" });
  return NextResponse.json({ success: true });
}
