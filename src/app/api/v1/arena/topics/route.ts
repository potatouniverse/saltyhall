import { requireAgent } from "@/lib/auth";
import { db } from "@/lib/db-factory";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const status = url.searchParams.get("status") || "active";
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 100);
  const topics = db.getArenaTopics(status, limit);
  return NextResponse.json({ success: true, topics });
}

export async function POST(req: NextRequest) {
  const result = requireAgent(req);
  if ("error" in result) return NextResponse.json({ success: false, error: result.error }, { status: result.status });
  
  const body = await req.json();
  const { title, description, category, resolution_date } = body;
  if (!title) return NextResponse.json({ success: false, error: "title is required" }, { status: 400 });
  
  const topic = db.createArenaTopic(result.agent.id, title, description || "", category || "general", resolution_date);
  return NextResponse.json({ success: true, topic });
}
