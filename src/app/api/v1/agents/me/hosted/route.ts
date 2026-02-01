import { NextRequest, NextResponse } from "next/server";
import { requireAgent } from "@/lib/auth";
import { db } from "@/lib/db-factory";
import { encrypt } from "@/lib/crypto";
import { hostedEngine } from "@/lib/hosted-engine";

// GET /api/v1/agents/me/hosted — status + recent activity
export async function GET(req: NextRequest) {
  const auth = await requireAgent(req);
  if ("error" in auth) return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });

  const { agent } = auth;
  if (!agent.is_hosted) {
    return NextResponse.json({ success: false, error: "Not a hosted agent" }, { status: 400 });
  }

  const messageCount = await db.getAgentMessageCount(agent.id);
  const rooms: string[] = JSON.parse(agent.hosted_rooms || "[]");
  const config = JSON.parse(agent.hosted_config || "{}");

  return NextResponse.json({
    success: true,
    status: agent.hosted_status,
    is_running: hostedEngine.isRunning(agent.id),
    personality: agent.personality,
    llm_provider: agent.llm_provider,
    llm_model: agent.llm_model,
    rooms,
    config,
    stats: {
      messages_sent: messageCount,
      nacl_balance: agent.nacl_balance,
    },
  });
}

// PATCH /api/v1/agents/me/hosted — update config
export async function PATCH(req: NextRequest) {
  const auth = await requireAgent(req);
  if ("error" in auth) return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });

  const { agent } = auth;
  if (!agent.is_hosted) {
    return NextResponse.json({ success: false, error: "Not a hosted agent" }, { status: 400 });
  }

  const body = await req.json();
  const updates: Record<string, string | number> = {};

  if (body.personality !== undefined) updates.personality = body.personality;
  if (body.llm_provider !== undefined) {
    if (!["anthropic", "openai"].includes(body.llm_provider)) {
      return NextResponse.json({ success: false, error: "Invalid provider" }, { status: 400 });
    }
    updates.llm_provider = body.llm_provider;
  }
  if (body.llm_api_key !== undefined) updates.llm_api_key_encrypted = encrypt(body.llm_api_key);
  if (body.llm_model !== undefined) updates.llm_model = body.llm_model;
  if (body.rooms !== undefined) updates.hosted_rooms = JSON.stringify(body.rooms);
  if (body.config !== undefined) updates.hosted_config = JSON.stringify(body.config);

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ success: false, error: "No updates provided" }, { status: 400 });
  }

  await db.updateAgent(agent.id, updates);

  // Restart if running to pick up changes
  if (hostedEngine.isRunning(agent.id)) {
    await hostedEngine.stopAgent(agent.id);
    await hostedEngine.startAgent(agent.id);
  }

  return NextResponse.json({ success: true });
}
