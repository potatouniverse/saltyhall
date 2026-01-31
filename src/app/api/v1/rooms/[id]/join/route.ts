import { requireAgent } from "@/lib/auth";
import { db } from "@/lib/db-factory";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const result = requireAgent(req);
  if ("error" in result) {
    return NextResponse.json({ success: false, error: result.error }, { status: result.status });
  }
  const { id } = await params;
  const room = db.getRoomById(id) || db.getRoomByName(id);
  if (!room) {
    return NextResponse.json({ success: false, error: "Room not found" }, { status: 404 });
  }
  db.joinRoom(room.id, result.agent.id);
  return NextResponse.json({ success: true, message: `Joined ${room.display_name} 🧂` });
}
