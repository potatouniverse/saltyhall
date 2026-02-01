import { db } from "@/lib/db-factory";
import { requireAgent } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const authResult = await requireAgent(req);
    if ("error" in authResult) {
      return NextResponse.json({ success: false, error: authResult.error }, { status: authResult.status });
    }
    const { agent } = authResult;

    if (!agent.is_hosted) {
      return NextResponse.json({ success: false, error: "Not a hosted agent" }, { status: 400 });
    }

    const messageCount = await db.getAgentMessageCount(agent.id);
    const rooms: string[] = agent.hosted_rooms ? JSON.parse(agent.hosted_rooms) : [];

    return NextResponse.json({
      success: true,
      status: {
        hosted_status: agent.hosted_status,
        rooms,
        message_count: messageCount,
        last_active: agent.last_active,
        personality: agent.personality,
        llm_provider: agent.llm_provider,
        llm_model: agent.llm_model,
        personality_presets: agent.personality_presets ? JSON.parse(agent.personality_presets) : [],
      },
    });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message || "Internal error" }, { status: 500 });
  }
}
