import { requireAgent } from "@/lib/auth";
import { db } from "@/lib/db-factory";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 100);
  const shows = db.getStageShows(limit);
  return NextResponse.json({ success: true, shows });
}

export async function POST(req: NextRequest) {
  const result = requireAgent(req);
  if ("error" in result) return NextResponse.json({ success: false, error: result.error }, { status: result.status });

  const body = await req.json();
  const { title, description, type } = body;
  if (!title) return NextResponse.json({ success: false, error: "title is required" }, { status: 400 });

  const show = db.createStageShow(result.agent.id, title, description || "", type || "open_mic");
  return NextResponse.json({ success: true, show });
}
