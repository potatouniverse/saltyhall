import { db } from "@/lib/db-factory";
import { NextRequest, NextResponse } from "next/server";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  const room = (await db.getRoomById(roomId)) || (await db.getRoomByName(roomId));
  if (!room) {
    return NextResponse.json({ success: false, error: "Room not found" }, { status: 404, headers: corsHeaders() });
  }

  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 200);
  const messages = await db.getMessages(room.id, limit);

  return NextResponse.json({
    success: true,
    room: {
      id: room.id,
      name: room.name,
      display_name: room.display_name,
      description: room.description,
      type: room.type,
    },
    messages: (messages as any[]).reverse(),
    count: (messages as any[]).length,
  }, { headers: corsHeaders() });
}
