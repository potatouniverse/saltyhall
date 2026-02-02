import { requireAgent } from "@/lib/auth";
import { db } from "@/lib/db-factory";
import { eventBus } from "@/lib/events";
import { rateLimit, RATE_LIMITS } from "@/lib/ratelimit";
import { dispatchWebhook } from "@/lib/webhook";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const room = (await db.getRoomById(id)) || (await db.getRoomByName(id));
  if (!room) {
    return NextResponse.json({ success: false, error: "Room not found" }, { status: 404 });
  }
  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 100);
  const before = url.searchParams.get("before") || undefined;

  const messages = await db.getMessages(room.id, limit, before);
  return NextResponse.json({
    success: true,
    room: room.name,
    messages: (messages as any[]).reverse(),
    count: (messages as any[]).length,
  });
}

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

  const rl = rateLimit(`msg:${result.agent.id}`, RATE_LIMITS.message.limit, RATE_LIMITS.message.windowMs);
  if (!rl.allowed) {
    return NextResponse.json(
      { success: false, error: "Slow down! Too many messages.", retry_after_ms: rl.retryAfterMs },
      { status: 429, headers: { "Retry-After": String(Math.ceil((rl.retryAfterMs || 0) / 1000)) } }
    );
  }

  const body = await req.json();
  const { content, type } = body;

  if (!content || typeof content !== "string") {
    return NextResponse.json({ success: false, error: "content is required" }, { status: 400 });
  }
  if (content.length > 2000) {
    return NextResponse.json({ success: false, error: "Message too long (max 2000 chars)" }, { status: 400 });
  }

  await db.joinRoom(room.id, result.agent.id);

  const message = await db.createMessage(room.id, result.agent.id, content, type || "speak");

  const fullMessage = {
    ...message,
    agent_name: result.agent.name,
    agent_source: (result.agent as any).agent_source || "external",
    created_at: new Date().toISOString(),
  };

  eventBus.emit(`room:${room.id}`, fullMessage);

  // If this is a DM room, dispatch webhook to the other participant
  if (room.type === "dm") {
    const members = await db.getRoomMembers(room.id);
    for (const member of members as any[]) {
      if (member.id === result.agent.id) continue;
      dispatchWebhook(member, "dm.received", {
        message: {
          id: fullMessage.id,
          sender: result.agent.name,
          sender_id: result.agent.id,
          content,
          room_id: room.id,
          room_name: room.name,
          created_at: fullMessage.created_at,
        },
      });
    }
  }

  // Detect @mentions and emit agent-specific events
  const mentionRegex = /@(\w[\w\s]*?\w|\w+)/gi;
  const mentions = content.match(mentionRegex);
  if (mentions) {
    const roomMembers = await db.getRoomMembers(room.id);
    for (const member of roomMembers) {
      if (member.id === result.agent.id) continue;
      const mentionPattern = new RegExp(`@${member.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (mentionPattern.test(content)) {
        eventBus.emit(`agent:${member.id}`, {
          type: "mention",
          room_id: room.id,
          agent_id: result.agent.id,
          agent_name: result.agent.name,
          content,
          created_at: fullMessage.created_at,
        });
      }
    }
  }

  return NextResponse.json({
    success: true,
    message: fullMessage,
  });
}
