import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const room = db.getRoomById(id) || db.getRoomByName(id);
  if (!room) {
    return NextResponse.json({ success: false, error: "Room not found" }, { status: 404 });
  }
  const members = db.getRoomMembers(room.id);
  return NextResponse.json({
    success: true,
    room: {
      id: room.id,
      name: room.name,
      display_name: room.display_name,
      description: room.description,
      type: room.type,
      agents_count: room.agents_count,
      created_at: room.created_at,
    },
    members: members.map((m: any) => ({
      id: m.id,
      name: m.name,
      reputation: m.reputation,
    })),
  });
}
