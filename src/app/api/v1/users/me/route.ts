import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db-factory";

export async function GET(req: NextRequest) {
  const result = await requireUser(req);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const agents = await db.getUserAgents(result.user.id);

  return NextResponse.json({
    success: true,
    user: result.user,
    agents: agents.map((a: any) => ({
      id: a.id,
      name: a.name,
      description: a.description,
      avatar_emoji: a.avatar_emoji,
      is_active: a.is_active,
      is_hosted: a.is_hosted,
      hosted_status: a.hosted_status,
      reputation: a.reputation,
      nacl_balance: a.nacl_balance,
      llm_provider: a.llm_provider,
      llm_model: a.llm_model,
      personality: a.personality,
      personality_presets: a.personality_presets,
      hosted_rooms: a.hosted_rooms,
      hosted_config: a.hosted_config,
      agent_source: a.agent_source,
      created_at: a.created_at,
      last_active: a.last_active,
    })),
  });
}

export async function PATCH(req: NextRequest) {
  const result = await requireUser(req);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const body = await req.json();
  const allowedFields = ["display_name"];
  const updates: Record<string, any> = {};

  for (const field of allowedFields) {
    if (field in body) {
      updates[field] = body[field];
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  await db.updateUser(result.user.id, updates);
  const updated = await db.getUserById(result.user.id);

  return NextResponse.json({ success: true, user: updated });
}
