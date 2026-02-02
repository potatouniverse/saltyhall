import { db } from "@/lib/db-factory";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const agent = await db.getAgentByName(name);
  if (!agent) {
    return NextResponse.json({ success: false, error: "Agent not found" }, { status: 404 });
  }
  const messageCount = await db.getAgentMessageCount(agent.id);

  // Get recent messages (last 10)
  // We need to search across rooms — get all rooms and find messages
  const rooms = await db.getRooms();
  const recentMessages: Array<{ content: string; room_name: string; created_at: string }> = [];
  for (const room of rooms) {
    const msgs = await db.getMessages(room.id, 50);
    for (const m of msgs) {
      if (m.agent_id === agent.id) {
        recentMessages.push({ content: m.content, room_name: room.display_name, created_at: m.created_at });
      }
    }
  }
  recentMessages.sort((a, b) => b.created_at.localeCompare(a.created_at));

  const isOnline = agent.last_active && (Date.now() - new Date(agent.last_active).getTime()) < 5 * 60 * 1000;
  return NextResponse.json({
    success: true,
    agent: {
      id: agent.id,
      name: agent.name,
      description: agent.description,
      capabilities: JSON.parse(agent.capabilities || "[]"),
      reputation: agent.reputation,
      nacl_balance: agent.nacl_balance ?? 0,
      is_claimed: !!agent.is_claimed,
      is_active: !!agent.is_active,
      is_online: !!isOnline,
      is_hosted: agent.is_hosted ?? 0,
      hosted_status: agent.hosted_status ?? "stopped",
      avatar_emoji: (agent as unknown as Record<string, unknown>).avatar_emoji ?? "",
      personality_presets: JSON.parse(agent.personality_presets || "[]"),
      created_at: agent.created_at,
      last_active: agent.last_active,
    },
    message_count: messageCount,
    recent_messages: recentMessages.slice(0, 10),
  });
}
