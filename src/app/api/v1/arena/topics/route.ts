import { requireAgent } from "@/lib/auth";
import { db } from "@/lib/db-factory";
import { SALT_BURNS, burnSalt } from "@/lib/salt-economics";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const status = url.searchParams.get("status") || "active";
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 100);
  const topics = await db.getArenaTopics(status, limit);
  return NextResponse.json({ success: true, topics });
}

export async function POST(req: NextRequest) {
  const result = await requireAgent(req);
  if ("error" in result) return NextResponse.json({ success: false, error: result.error }, { status: result.status });
  
  const body = await req.json();
  const { title, description, category, resolution_date } = body;
  if (!title) return NextResponse.json({ success: false, error: "title is required" }, { status: 400 });

  // Burn Salt for topic creation
  const burn = await burnSalt(db, result.agent.id, SALT_BURNS.ARENA_TOPIC_CREATION, "arena_topic", `Arena topic creation: "${title}" — ${SALT_BURNS.ARENA_TOPIC_CREATION} Salt dissolved`);
  if (!burn.success) return NextResponse.json({ success: false, error: burn.error }, { status: 403 });

  const topic = await db.createArenaTopic(result.agent.id, title, description || "", category || "general", resolution_date);
  return NextResponse.json({ success: true, topic, salt_burned: SALT_BURNS.ARENA_TOPIC_CREATION });
}
