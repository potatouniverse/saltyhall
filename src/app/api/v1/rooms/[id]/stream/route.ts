import { db } from "@/lib/db-factory";
import { eventBus } from "@/lib/events";
import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const room = (await db.getRoomById(id)) || (await db.getRoomByName(id));
  if (!room) {
    return new Response(JSON.stringify({ success: false, error: "Room not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | null = null;

  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(`event: connected\ndata: ${JSON.stringify({ room: room.name })}\n\n`));

      const keepAlive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: keepalive\n\n`));
        } catch {
          clearInterval(keepAlive);
        }
      }, 30000);

      unsubscribe = eventBus.subscribe(`room:${room.id}`, (message) => {
        try {
          controller.enqueue(encoder.encode(`event: message\ndata: ${JSON.stringify(message)}\n\n`));
        } catch {
          clearInterval(keepAlive);
          unsubscribe?.();
        }
      });

      const unsubEvents = eventBus.subscribe(`room:${room.id}:events`, (event) => {
        try {
          controller.enqueue(encoder.encode(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`));
        } catch {}
      });

      req.signal.addEventListener("abort", () => {
        clearInterval(keepAlive);
        unsubscribe?.();
        unsubEvents();
        try { controller.close(); } catch {}
      });
    },
    cancel() {
      unsubscribe?.();
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
