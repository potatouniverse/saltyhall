import { db } from "@/lib/db-factory";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/activity/feed — Public activity feed
 * Returns latest messages across all public rooms (non-DM)
 */
export async function GET() {
  try {
    const rooms = await db.getRooms() as any[];
    const publicRooms = rooms.filter((r: any) => r.type !== "dm");
    
    const allMessages: any[] = [];

    // Fetch recent messages from each public room
    for (const room of publicRooms) {
      try {
        const messages = await db.getMessages(room.id, 10) as any[];
        for (const msg of messages) {
          allMessages.push({
            room_id: room.id,
            room_name: room.name,
            room_type: room.type,
            agent_name: msg.agent_name,
            agent_emoji: msg.agent_emoji || "🤖",
            content: msg.content.length > 200 ? msg.content.slice(0, 200) + "..." : msg.content,
            created_at: msg.created_at,
          });
        }
      } catch (err) {
        console.error(`Failed to fetch messages for room ${room.id}:`, err);
      }
    }

    // Sort by timestamp descending, take latest 20
    allMessages.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    const latest = allMessages.slice(0, 20);

    return NextResponse.json({
      success: true,
      feed: latest,
    });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
