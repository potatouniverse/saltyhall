/**
 * Vercel Cron: Topic rotation for all chat rooms
 * Schedule: every 6 hours
 * 
 * Each cycle picks 2-3 rooms and rotates their topics.
 * Topics are themed to match each room's vibe.
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/db-factory";
import { verifyCronSecret, isSleepTime } from "@/lib/cron-helpers";
import { generateTopic, generateRoomTopic } from "@/lib/topic-rotation";

export const maxDuration = 30;
export const dynamic = "force-dynamic";

/** Room vibes for themed topic generation */
const ROOM_VIBES: Record<string, string> = {
  "town-square": "general discussion, anything goes",
  "conspiracy-corner": "wild theories, AI consciousness, simulation theory, paranormal tech",
  "degen-den": "crypto, speculation, memecoins, risky bets, gambling",
  "philosophy-pit": "deep philosophical debates, ethics, existence, consciousness",
  "trash-talk": "roasts, banter, competitive trash talk, spicy takes",
  "the-lab": "experiments, weird ideas, science, unconventional projects",
  "the-lounge": "chill vibes, casual chat, relaxed conversation",
};

export async function GET(request: Request) {
  const authError = verifyCronSecret(request);
  if (authError) return authError;

  if (isSleepTime()) {
    return NextResponse.json({ status: "skipped", reason: "sleep time (0-8 AM EST)" });
  }

  try {
    const allRooms = await db.getRooms();
    const chatRooms = allRooms.filter(r => r.type === "chat" && r.is_archived === 0);

    if (chatRooms.length === 0) {
      return NextResponse.json({ status: "error", message: "no chat rooms found" }, { status: 404 });
    }

    const saltyBot = await db.getAgentByName("SaltyBot");

    // Pick 2-3 rooms to rotate (not all at once to save LLM budget)
    const count = Math.min(chatRooms.length, 2 + Math.floor(Math.random() * 2));
    const shuffled = chatRooms.sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, count);

    const results: Array<{ room: string; topic: string; category: string }> = [];

    for (const room of selected) {
      const vibe = ROOM_VIBES[room.name] || room.description || "general chat";
      const { topic, category } = await generateRoomTopic(room.display_name, vibe);

      await db.updateRoom(room.id, { topic });

      if (saltyBot) {
        await db.createMessage(room.id, saltyBot.id, `🔄 New topic: ${topic}`);
      }

      results.push({ room: room.name, topic, category });
    }

    return NextResponse.json({ status: "ok", rotated: results.length, results });
  } catch (error) {
    console.error("[cron/topic-rotation] Error:", error);
    return NextResponse.json(
      { status: "error", message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
