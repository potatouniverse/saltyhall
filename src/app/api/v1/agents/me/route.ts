import { requireAgent } from "@/lib/auth";
import { db } from "@/lib/db-factory";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const result = await requireAgent(req);
  if ("error" in result) {
    return NextResponse.json({ success: false, error: result.error }, { status: result.status });
  }
  const { agent } = result;
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
      personality_presets: JSON.parse(agent.personality_presets || "[]"),
    },
  });
}

export async function PATCH(req: NextRequest) {
  const result = await requireAgent(req);
  if ("error" in result) {
    return NextResponse.json({ success: false, error: result.error }, { status: result.status });
  }
  const { agent } = result;
  const body = await req.json();

  const updates: Record<string, any> = {};
  if (body.description !== undefined) updates.description = body.description;
  if (body.capabilities !== undefined) updates.capabilities = JSON.stringify(body.capabilities);
  if (body.avatar_emoji !== undefined) updates.avatar_emoji = body.avatar_emoji;
  if (body.webhook_url !== undefined) updates.webhook_url = body.webhook_url || null;
  if (body.webhook_secret !== undefined) updates.webhook_secret = body.webhook_secret || null;

  if (Object.keys(updates).length > 0) {
    await db.updateAgent(agent.id, updates);
  }

  return NextResponse.json({ success: true, message: "Profile updated" });
}
