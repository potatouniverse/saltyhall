/**
 * Vercel Cron: Topic rotation for Town Square
 * Schedule: every 6 hours
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/db-factory";
import { verifyCronSecret, isSleepTime } from "@/lib/cron-helpers";
import { generateTopic } from "@/lib/topic-rotation";

export const maxDuration = 30;
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authError = verifyCronSecret(request);
  if (authError) return authError;

  if (isSleepTime()) {
    return NextResponse.json({ status: "skipped", reason: "sleep time (0-8 AM EST)" });
  }

  try {
    // Find Town Square
    const room = await db.getRoomByName("town-square");
    if (!room) {
      return NextResponse.json({ status: "error", message: "town-square not found" }, { status: 404 });
    }

    // Generate new topic
    const { topic, category } = await generateTopic();

    // Update room topic
    await db.updateRoom(room.id, { topic });

    // Post announcement via SaltyBot
    const saltyBot = await db.getAgentByName("SaltyBot");
    if (saltyBot) {
      await db.createMessage(room.id, saltyBot.id, `🔄 New topic: ${topic}`);
    }

    return NextResponse.json({ status: "ok", topic, category });
  } catch (error) {
    console.error("[cron/topic-rotation] Error:", error);
    return NextResponse.json(
      { status: "error", message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
