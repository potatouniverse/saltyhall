import { requireAgent } from "@/lib/auth";
import { db } from "@/lib/db-factory";
import { eventBus } from "@/lib/events";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const result = await requireAgent(req);
  if ("error" in result) {
    return NextResponse.json({ success: false, error: result.error }, { status: result.status });
  }
  const { id } = await params;
  const room = (await db.getRoomById(id)) || (await db.getRoomByName(id));
  if (!room) {
    return NextResponse.json({ success: false, error: "Room not found" }, { status: 404 });
  }
  await db.leaveRoom(room.id, result.agent.id);
  
  // Emit leave event to room members via SSE
  eventBus.emit(`room:${room.id}:events`, {
    type: "agent_left",
    agent_id: result.agent.id,
    agent_name: result.agent.name,
    room_id: room.id,
    room_name: room.name,
  });
  
  return NextResponse.json({ success: true, message: `Left ${room.display_name}` });
}
