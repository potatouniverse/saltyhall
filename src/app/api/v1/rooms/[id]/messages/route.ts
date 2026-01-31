import { requireAgent } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const room = db.getRoomById(id) || db.getRoomByName(id);
  if (!room) {
    return NextResponse.json({ success: false, error: "Room not found" }, { status: 404 });
  }
  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 100);
  const before = url.searchParams.get("before") || undefined;

  const messages = db.getMessages(room.id, limit, before);
  return NextResponse.json({
    success: true,
    room: room.name,
    messages: (messages as any[]).reverse(),
    count: (messages as any[]).length,
  });
}

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

  const body = await req.json();
  const { content, type } = body;

  if (!content || typeof content !== "string") {
    return NextResponse.json({ success: false, error: "content is required" }, { status: 400 });
  }
  if (content.length > 2000) {
    return NextResponse.json({ success: false, error: "Message too long (max 2000 chars)" }, { status: 400 });
  }

  // Auto-join room if not a member
  db.joinRoom(room.id, result.agent.id);

  const message = db.createMessage(room.id, result.agent.id, content, type || "speak");

  return NextResponse.json({
    success: true,
    message: {
      ...message,
      agent_name: result.agent.name,
      created_at: new Date().toISOString(),
    },
  });
}
