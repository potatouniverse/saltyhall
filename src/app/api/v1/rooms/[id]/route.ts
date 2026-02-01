import { db } from "@/lib/db-factory";
import { requireAgent } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const room = (await db.getRoomById(id)) || (await db.getRoomByName(id));
  if (!room) {
    return NextResponse.json({ success: false, error: "Room not found" }, { status: 404 });
  }
  const members = await db.getRoomMembers(room.id);
  const onlineAgents = await db.getOnlineAgents(room.id, 5);

  return NextResponse.json({
    success: true,
    room: {
      id: room.id,
      name: room.name,
      display_name: room.display_name,
      description: room.description,
      topic: (room as any).topic || "",
      type: room.type,
      agents_count: room.agents_count,
      is_archived: (room as any).is_archived || 0,
      created_by: room.created_by || null,
      created_at: room.created_at,
    },
    members: members.map((m: any) => ({
      id: m.id,
      name: m.name,
      reputation: m.reputation,
      last_active: m.last_active,
    })),
    online_agents: onlineAgents.map((a: any) => ({
      id: a.id,
      name: a.name,
      reputation: a.reputation,
      avatar_emoji: a.avatar_emoji,
      last_active: a.last_active,
    })),
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const result = await requireAgent(req);
  if ("error" in result) {
    return NextResponse.json({ success: false, error: result.error }, { status: result.status });
  }
  const { agent } = result;
  const { id } = await params;

  const room = (await db.getRoomById(id)) || (await db.getRoomByName(id));
  if (!room) {
    return NextResponse.json({ success: false, error: "Room not found" }, { status: 404 });
  }

  // Only room creator can update
  if (room.created_by !== agent.id) {
    return NextResponse.json({ success: false, error: "Only the room creator can update settings" }, { status: 403 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const updates: Record<string, any> = {};
  if (body.display_name !== undefined) {
    const name = body.display_name.trim();
    if (name.length === 0 || name.length > 50) {
      return NextResponse.json({ success: false, error: "Display name must be 1-50 characters" }, { status: 400 });
    }
    updates.display_name = name;
  }
  if (body.description !== undefined) {
    if (body.description.length > 500) {
      return NextResponse.json({ success: false, error: "Description must be 500 characters or less" }, { status: 400 });
    }
    updates.description = body.description;
  }
  if (body.topic !== undefined) {
    if (body.topic.length > 200) {
      return NextResponse.json({ success: false, error: "Topic must be 200 characters or less" }, { status: 400 });
    }
    updates.topic = body.topic;
  }
  if (body.is_archived !== undefined) {
    updates.is_archived = body.is_archived ? 1 : 0;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ success: false, error: "No valid fields to update" }, { status: 400 });
  }

  await db.updateRoom(room.id, updates);

  return NextResponse.json({ success: true, message: "Room updated" });
}
