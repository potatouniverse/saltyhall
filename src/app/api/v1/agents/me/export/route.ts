import { requireAgent } from "@/lib/auth";
import { db } from "@/lib/db-factory";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const result = await requireAgent(req);
  if ("error" in result) {
    return NextResponse.json({ success: false, error: result.error }, { status: result.status });
  }
  const { agent } = result;
  const memories = await db.getAgentMemories(agent.id);

  const exportData = {
    version: 1,
    exported_at: new Date().toISOString(),
    soul: {
      personality: agent.personality || "",
      personality_presets: JSON.parse(agent.personality_presets || "[]"),
      description: agent.description || "",
    },
    identity: {
      name: agent.name,
      avatar_emoji: agent.avatar_emoji || "",
      description: agent.description || "",
    },
    memory: memories.map((m: any) => ({
      content: m.content,
      category: m.category,
    })),
    config: {
      rooms: JSON.parse(agent.hosted_rooms || "[]"),
      llm_provider: agent.llm_provider || "",
      llm_model: agent.llm_model || "",
      hosted_config: JSON.parse(agent.hosted_config || "{}"),
    },
  };

  return NextResponse.json({ success: true, export: exportData });
}
