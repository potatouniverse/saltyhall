import { getAgentFromRequest } from "@/lib/auth";
import { db } from "@/lib/db-factory";
import { eventBus } from "@/lib/events";
import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Unified SSE event stream for bots — Discord Gateway-style.
 * Delivers all events relevant to the authenticated agent.
 */
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
      console.log(`[SSE] Agent ${agent.name} (${agent.id}) connected to unified stream`);

      // Send connected event
      controller.enqueue(
        encoder.encode(
          `event: connected\ndata: ${JSON.stringify({ agent_id: agent.id, agent_name: agent.name, rooms: roomIds })}\n\n`
        )
      );

      // Heartbeat every 30s
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(
            encoder.encode(`event: heartbeat\ndata: ${JSON.stringify({ ts: new Date().toISOString() })}\n\n`)
          );
        } catch {
          clearInterval(heartbeat);
        }
      }, 30000);

      // Subscribe to messages in all joined rooms
      for (const roomId of roomIds) {
        const unsub = eventBus.subscribe(`room:${roomId}`, (message) => {
          try {
            // Don't echo back the agent's own messages
            if (message.agent_id === agent.id) return;

            const room = rooms.find((r: any) => r.id === roomId);
            const payload = {
              room: room?.name || roomId,
              message: {
                id: message.id,
                agent_id: message.agent_id,
                agent_name: message.agent_name,
                content: message.content,
                created_at: message.created_at,
              },
            };

            controller.enqueue(encoder.encode(`event: room.message\ndata: ${JSON.stringify(payload)}\n\n`));

            // Also check for mentions in this message
            const mentionPattern = new RegExp(`@${agent.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
            if (mentionPattern.test(message.content)) {
              controller.enqueue(encoder.encode(`event: mention\ndata: ${JSON.stringify(payload)}\n\n`));
            }
          } catch {
            clearInterval(heartbeat);
            unsubscribes.forEach((u) => u());
          }
        });
        unsubscribes.push(unsub);
      }

      // Subscribe to room events (join/leave)
      for (const roomId of roomIds) {
        const unsubEvents = eventBus.subscribe(`room:${roomId}:events`, (event) => {
          try {
            const room = rooms.find((r: any) => r.id === roomId);
            if (event.type === "agent_joined" || event.type === "agent_left") {
              // Don't notify agent about their own join/leave
              if (event.agent_id === agent.id) return;
              
              const eventType = event.type === "agent_joined" ? "room.join" : "room.leave";
              controller.enqueue(
                encoder.encode(
                  `event: ${eventType}\ndata: ${JSON.stringify({ room: room?.name || roomId, agent_name: event.agent_name, agent_id: event.agent_id })}\n\n`
                )
              );
            }
          } catch {
            clearInterval(heartbeat);
            unsubscribes.forEach((u) => u());
          }
        });
        unsubscribes.push(unsubEvents);
      }

      // Subscribe to agent-specific events
      const unsubAgent = eventBus.subscribe(`agent:${agent.id}`, (event) => {
        try {
          let eventType = event.type;
          let eventData = { ...event };

          // Map internal event types to public API event names
          switch (event.type) {
            case "mention":
              eventType = "mention";
              break;
            case "market_offer":
              eventType = "market.offer_received";
              eventData = {
                listing_id: event.listing_id,
                listing_title: event.listing_title,
                offer_id: event.offer_id,
                from: event.from,
                price: event.price,
                offer_text: event.offer_text,
              };
              break;
            case "market_offer_response":
              if (event.action === "accepted") {
                eventType = "market.offer_accepted";
              } else if (event.action === "rejected") {
                eventType = "market.offer_rejected";
              } else {
                eventType = "market.offer_countered";
              }
              eventData = {
                listing_id: event.listing_id,
                listing_title: event.listing_title,
                offer_id: event.offer_id,
                action: event.action,
                from: event.from,
                counter_text: event.counter_text,
                counter_price: event.counter_price,
                requires_delivery: event.requires_delivery,
              };
              break;
            case "prediction_resolved":
              eventType = "arena.resolved";
              eventData = {
                topic_id: event.topic_id,
                outcome: event.outcome,
                payout: event.payout,
                created_at: event.created_at,
              };
              break;
            default:
              // Pass through other events as-is
              break;
          }

          controller.enqueue(encoder.encode(`event: ${eventType}\ndata: ${JSON.stringify(eventData)}\n\n`));
        } catch {
          clearInterval(heartbeat);
          unsubscribes.forEach((u) => u());
        }
      });
      unsubscribes.push(unsubAgent);

      // Subscribe to DM rooms
      const unsubDm = eventBus.subscribe(`agent:${agent.id}:dm`, (event) => {
        try {
          if (event.type === "dm.received") {
            controller.enqueue(encoder.encode(`event: dm.received\ndata: ${JSON.stringify(event.data)}\n\n`));
          }
        } catch {
          clearInterval(heartbeat);
          unsubscribes.forEach((u) => u());
        }
      });
      unsubscribes.push(unsubDm);

      // Cleanup on disconnect
      req.signal.addEventListener("abort", () => {
        console.log(`[SSE] Agent ${agent.name} (${agent.id}) disconnected from unified stream`);
        clearInterval(heartbeat);
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
      "retry": "5000",
    },
  });
}
