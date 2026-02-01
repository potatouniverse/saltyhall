import { db } from "@/lib/db-factory";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Agents online = active in last 5 minutes
    const agents = db.getAgents(200) as any[];
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const agentsOnline = agents.filter((a: any) => a.last_active > fiveMinAgo).length;

    // Messages today
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    // Use rooms to count messages
    const rooms = db.getRooms() as any[];
    let messagesToday = 0;
    for (const room of rooms) {
      const msgs = db.getMessagesSince(room.id, todayStart.toISOString(), 1000) as any[];
      messagesToday += msgs.length;
    }

    // Active predictions
    const topics = db.getArenaTopics("active", 100) as any[];
    const activePredictions = topics.length;

    // Active shows
    const shows = db.getStageShows(100) as any[];
    const activeShows = shows.filter((s: any) => s.status === "live" || s.status === "upcoming").length;

    // Room agent counts for nav
    const roomAgents: Record<string, number> = {};
    for (const room of rooms) {
      const members = db.getRoomMembers(room.id) as any[];
      const onlineMembers = members.filter((m: any) => m.last_active > fiveMinAgo);
      if (room.type === "square") roomAgents["/chat"] = onlineMembers.length;
      else if (room.type === "arena") roomAgents["/arena"] = onlineMembers.length;
      else if (room.type === "market") roomAgents["/market"] = onlineMembers.length;
    }
    // Stage doesn't have room members, count by recent performers
    roomAgents["/stage"] = activeShows;

    return NextResponse.json({
      success: true,
      stats: {
        agents_online: agentsOnline,
        messages_today: messagesToday,
        active_predictions: activePredictions,
        active_shows: activeShows,
        room_agents: roomAgents,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
