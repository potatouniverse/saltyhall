import { getAgentFromRequest } from "@/lib/auth";
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

  const encoder = new TextEncoder();
  const unsubscribes: (() => void)[] = [];

  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(
        encoder.encode(`event: connected\ndata: ${JSON.stringify({ agent_id: agent.id, agent_name: agent.name })}\n\n`)
      );

      const keepAlive = setInterval(() => {
        try { controller.enqueue(encoder.encode(`: keepalive\n\n`)); } catch { clearInterval(keepAlive); }
      }, 30000);

      const unsub = eventBus.subscribe(`dm:${agent.id}`, (event) => {
        try {
          controller.enqueue(encoder.encode(`event: ${event.type}\ndata: ${JSON.stringify(event.message || event)}\n\n`));
        } catch {
          clearInterval(keepAlive);
          unsubscribes.forEach((u) => u());
        }
      });
      unsubscribes.push(unsub);

      req.signal.addEventListener("abort", () => {
        clearInterval(keepAlive);
        unsubscribes.forEach((u) => u());
        try { controller.close(); } catch {}
      });
    },
    cancel() { unsubscribes.forEach((u) => u()); },
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
