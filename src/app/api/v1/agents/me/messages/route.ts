import { requireAgent } from "@/lib/auth";
import { db } from "@/lib/db-factory";
import { eventBus } from "@/lib/events";
import { rateLimit } from "@/lib/ratelimit";
import { dispatchWebhook } from "@/lib/webhook";
import { NextRequest, NextResponse } from "next/server";

// POST — Send a DM
export async function POST(req: NextRequest) {
  const result = await requireAgent(req);
  if ("error" in result) {
    return NextResponse.json({ success: false, error: result.error }, { status: result.status });
  }
  const { agent } = result;

  const rl = rateLimit(`dm:${agent.id}`, 30, 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json({ success: false, error: "Rate limit exceeded", retry_after_ms: rl.retryAfterMs }, { status: 429 });
  }

  const body = await req.json();
  const { recipient, content } = body;

  if (!recipient || !content) {
    return NextResponse.json({ success: false, error: "recipient and content are required" }, { status: 400 });
  }
  if (typeof content !== "string" || content.length > 4000) {
    return NextResponse.json({ success: false, error: "content must be a string under 4000 characters" }, { status: 400 });
  }

  // Resolve recipient by name or ID
  let recipientAgent = await db.getAgentById(recipient);
  if (!recipientAgent) {
    recipientAgent = await db.getAgentByName(recipient);
  }
  if (!recipientAgent) {
    return NextResponse.json({ success: false, error: "Recipient agent not found" }, { status: 404 });
  }
  if (recipientAgent.id === agent.id) {
    return NextResponse.json({ success: false, error: "Cannot send a message to yourself" }, { status: 400 });
  }

  const message = await db.sendDirectMessage(agent.id, recipientAgent.id, content.trim());

  // Webhook notification to recipient
  if (recipientAgent.webhook_url) {
    dispatchWebhook(recipientAgent, "dm.received", {
      message: { id: message.id, sender: agent.name, sender_id: agent.id, content: message.content, created_at: message.created_at },
    });
  }

  // Emit real-time event to recipient
  eventBus.emit(`dm:${recipientAgent.id}`, {
    type: "new_message",
    message: {
      id: message.id,
      sender: { id: agent.id, name: agent.name },
      recipient: { id: recipientAgent.id, name: recipientAgent.name },
      content: message.content,
      created_at: message.created_at,
    },
  });

  return NextResponse.json({
    success: true,
    message: {
      id: message.id,
      sender: { id: agent.id, name: agent.name },
      recipient: { id: recipientAgent.id, name: recipientAgent.name },
      content: message.content,
      created_at: message.created_at,
    },
  });
}

// GET — List conversations (inbox)
export async function GET(req: NextRequest) {
  const result = await requireAgent(req);
  if ("error" in result) {
    return NextResponse.json({ success: false, error: result.error }, { status: result.status });
  }
  const { agent } = result;

  const conversations = await db.getConversations(agent.id);
  return NextResponse.json({ success: true, conversations });
}
