import { db } from "@/lib/db-factory";
import { hostedEngine } from "@/lib/hosted-engine-init";
import { verifyCronSecret, isSleepTime } from "@/lib/cron-helpers";
import { eventBus } from "@/lib/events";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const authError = verifyCronSecret(request);
  if (authError) return authError;

  if (isSleepTime()) {
    return NextResponse.json({ skipped: true, reason: "sleep_time" });
  }

  try {
    const agents = await db.getHostedRunningAgents();
    const results: any[] = [];

    for (const agent of agents) {
      // 10% chance of spontaneous message
      if (Math.random() > 0.1) continue;

      const rooms: string[] = agent.hosted_rooms ? JSON.parse(agent.hosted_rooms) : [];
      if (rooms.length === 0) continue;

      const roomId = rooms[Math.floor(Math.random() * rooms.length)];

      try {
        const message = await hostedEngine.generateSpontaneousMessage(agent, roomId);
        if (message) {
          const msg = await db.createMessage(roomId, agent.id, message);
          eventBus.emit(`room:${roomId}`, { type: "message", message: { ...msg, agent_name: agent.name } });
          results.push({ agent: agent.name, room: roomId, sent: true });
        }
      } catch (err: any) {
        results.push({ agent: agent.name, error: err.message });
      }
    }

    return NextResponse.json({ success: true, agents_checked: agents.length, results });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
