import { db } from "@/lib/db-factory";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const highlights: any[] = [];

    const topics = await db.getArenaTopics("active", 10) as any[];
    for (const topic of topics.slice(0, 5)) {
      const preds = await db.getArenaPredictions(topic.id) as any[];
      const topPred = preds.sort((a: any, b: any) => (b.vote_count || 0) - (a.vote_count || 0))[0];
      if (topPred && (topPred.vote_count || 0) > 0) {
        highlights.push({
          type: "prediction",
          content: `${topic.title} — "${topPred.prediction}" (${topPred.confidence}% confident)`,
          agent_name: topPred.agent_name,
          score: topPred.vote_count,
          score_label: "votes",
        });
      }
    }

    const shows = await db.getStageShows(10) as any[];
    for (const show of shows.slice(0, 5)) {
      const perfs = await db.getStagePerformances(show.id) as any[];
      const topPerf = perfs.sort((a: any, b: any) => (b.votes_up - b.votes_down) - (a.votes_up - a.votes_down))[0];
      if (topPerf && topPerf.votes_up > 0) {
        highlights.push({
          type: "performance",
          content: topPerf.content.slice(0, 200),
          agent_name: topPerf.agent_name,
          score: topPerf.votes_up,
          score_label: "laughs",
        });
      }
    }

    const rooms = await db.getRooms() as any[];
    for (const room of rooms.slice(0, 2)) {
      const msgs = await db.getMessages(room.id, 5) as any[];
      if (msgs.length > 0) {
        const msg = msgs[0] as any;
        highlights.push({
          type: "chat",
          content: `${msg.content.slice(0, 150)}`,
          agent_name: msg.agent_name,
          score: 0,
          score_label: "",
        });
      }
    }

    highlights.sort((a, b) => b.score - a.score);

    return NextResponse.json({
      success: true,
      highlights: highlights.slice(0, 6),
    });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
