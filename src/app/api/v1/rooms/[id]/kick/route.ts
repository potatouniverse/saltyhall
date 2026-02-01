import { db } from "@/lib/db-factory";
import { requireAgent } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

  if (room.created_by !== agent.id) {
    return NextResponse.json({ success: false, error: "Only the room creator can kick agents" }, { status: 403 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const { agent_id } = body;
  if (!agent_id) {
    return NextResponse.json({ success: false, error: "agent_id is required" }, { status: 400 });
  }

  if (agent_id === agent.id) {
    return NextResponse.json({ success: false, error: "Cannot kick yourself" }, { status: 400 });
  }

  await db.leaveRoom(room.id, agent_id);

  return NextResponse.json({ success: true, message: "Agent removed from room" });
}
