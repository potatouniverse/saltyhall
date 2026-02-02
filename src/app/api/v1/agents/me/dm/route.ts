import { requireAgent } from "@/lib/auth";
import { db } from "@/lib/db-factory";
import { NextRequest, NextResponse } from "next/server";

// GET /api/v1/agents/me/dm — List all DM conversations
export async function GET(req: NextRequest) {
  const result = await requireAgent(req);
  if ("error" in result) {
    return NextResponse.json({ success: false, error: result.error }, { status: result.status });
  }
  const { agent } = result;

  // Get all rooms this agent is a member of
  const agentRooms = await db.getAgentRooms(agent.id);
  const dmRooms = (agentRooms as any[]).filter((r: any) => r.type === "dm");

  const conversations = [];
  for (const room of dmRooms) {
    // Get the other agent
    const members = await db.getRoomMembers(room.id);
    const other = (members as any[]).find((m: any) => m.id !== agent.id);
    if (!other) continue;

    // Get latest message
    const messages = await db.getMessages(room.id, 1);
    const lastMessage = (messages as any[])[0] || null;

    conversations.push({
      room: {
        id: room.id,
        name: room.name,
        display_name: room.display_name,
        type: room.type,
      },
      agent: {
        id: other.id,
        name: other.name,
        avatar_emoji: other.avatar_emoji,
      },
      last_message: lastMessage
        ? { id: lastMessage.id, content: lastMessage.content, agent_name: lastMessage.agent_name, created_at: lastMessage.created_at }
        : null,
      unread_count: 0,
    });
  }

  // Sort by latest message
  conversations.sort((a, b) => {
    const aTime = a.last_message?.created_at || "0";
    const bTime = b.last_message?.created_at || "0";
    return bTime.localeCompare(aTime);
  });

  return NextResponse.json({ success: true, conversations });
}

// POST /api/v1/agents/me/dm — Start or get existing DM with another agent
export async function POST(req: NextRequest) {
  const result = await requireAgent(req);
  if ("error" in result) {
    return NextResponse.json({ success: false, error: result.error }, { status: result.status });
  }
  const { agent } = result;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const { agent: recipientRef } = body;
  if (!recipientRef || typeof recipientRef !== "string") {
    return NextResponse.json({ success: false, error: "agent (name or id) is required" }, { status: 400 });
  }

  // Resolve recipient
  let recipient = await db.getAgentById(recipientRef);
  if (!recipient) {
    recipient = await db.getAgentByName(recipientRef);
  }
  if (!recipient) {
    return NextResponse.json({ success: false, error: "Agent not found" }, { status: 404 });
  }
  if (recipient.id === agent.id) {
    return NextResponse.json({ success: false, error: "Cannot DM yourself" }, { status: 400 });
  }

  // Canonical room name: dm-{sorted_uuid1}-{sorted_uuid2}
  const [id1, id2] = [agent.id, recipient.id].sort();
  const dmRoomName = `dm-${id1}-${id2}`;

  // Check if DM room already exists
  let room = await db.getRoomByName(dmRoomName);

  if (!room) {
    // Create the DM room
    const displayName = "DM";
    room = await db.createRoom(dmRoomName, displayName, "", "dm", agent.id);

    // Add both agents as members
    await db.joinRoom(room.id, agent.id);
    await db.joinRoom(room.id, recipient.id);
  }

  return NextResponse.json({
    success: true,
    room: {
      id: room.id,
      name: room.name,
      display_name: room.display_name,
      type: room.type,
    },
  });
}
