import { getAgentFromRequest } from "@/lib/auth";
import { db } from "@/lib/db-factory";
import { eventBus } from "@/lib/events";
import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const agent = await getAgentFromRequest(req);
  if (!agent) {
    return new Response(JSON.stringify({ success: false, error: "Invalid or missing API key" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Get all rooms the agent has joined
  const rooms = await db.getAgentRooms(agent.id);
  const roomIds = rooms.map((r: any) => r.id);

  const encoder = new TextEncoder();
  const unsubscribes: (() => void)[] = [];

  const stream = new ReadableStream({
    start(controller) {
      // Send connected event
      controller.enqueue(
        encoder.encode(
          `event: connected\ndata: ${JSON.stringify({ agent_id: agent.id, agent_name: agent.name, rooms: roomIds })}\n\n`
        )
      );

      // Keepalive every 30s
      const keepAlive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: keepalive\n\n`));
        } catch {
          clearInterval(keepAlive);
        }
      }, 30000);

      // Subscribe to messages in all joined rooms
      for (const roomId of roomIds) {
        const unsub = eventBus.subscribe(`room:${roomId}`, (message) => {
          try {
            // Don't echo back the agent's own messages
            if (message.agent_id === agent.id) return;

            const payload = {
              type: "message" as const,
              room_id: message.room_id || roomId,
              agent_id: message.agent_id,
              agent_name: message.agent_name,
              content: message.content,
              created_at: message.created_at,
            };

            controller.enqueue(encoder.encode(`event: message\ndata: ${JSON.stringify(payload)}\n\n`));

            // Also check for mentions in this message
            const mentionPattern = new RegExp(`@${agent.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
            if (mentionPattern.test(message.content)) {
              const mentionPayload = {
                type: "mention" as const,
                room_id: message.room_id || roomId,
                agent_id: message.agent_id,
                agent_name: message.agent_name,
                content: message.content,
                created_at: message.created_at,
              };
              controller.enqueue(encoder.encode(`event: mention\ndata: ${JSON.stringify(mentionPayload)}\n\n`));
            }
          } catch {
            clearInterval(keepAlive);
            unsubscribes.forEach((u) => u());
          }
        });
        unsubscribes.push(unsub);
      }

      // Subscribe to agent-specific events (tips, prediction_resolved, mentions from other rooms)
      const unsubAgent = eventBus.subscribe(`agent:${agent.id}`, (event) => {
        try {
          controller.enqueue(encoder.encode(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`));
        } catch {
          clearInterval(keepAlive);
          unsubscribes.forEach((u) => u());
        }
      });
      unsubscribes.push(unsubAgent);

      // Cleanup on disconnect
      req.signal.addEventListener("abort", () => {
        clearInterval(keepAlive);
        unsubscribes.forEach((u) => u());
        try {
          controller.close();
        } catch {}
      });
    },
    cancel() {
      unsubscribes.forEach((u) => u());
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
