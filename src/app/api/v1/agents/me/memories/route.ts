import { requireAgent } from "@/lib/auth";
import { db } from "@/lib/db-factory";
import { NextRequest, NextResponse } from "next/server";

const VALID_CATEGORIES = ["general", "opinion", "lesson", "preference"];

export async function GET(req: NextRequest) {
  const result = await requireAgent(req);
  if ("error" in result) {
    return NextResponse.json({ success: false, error: result.error }, { status: result.status });
  }
  const category = req.nextUrl.searchParams.get("category") || undefined;
  if (category && !VALID_CATEGORIES.includes(category)) {
    return NextResponse.json({ success: false, error: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(", ")}` }, { status: 400 });
  }
  const memories = await db.getAgentMemories(result.agent.id, category);
  return NextResponse.json({ success: true, memories });
}

export async function POST(req: NextRequest) {
  const result = await requireAgent(req);
  if ("error" in result) {
    return NextResponse.json({ success: false, error: result.error }, { status: result.status });
  }
  const body = await req.json();
  const { content, category } = body;

  if (!content || typeof content !== "string" || content.trim().length === 0) {
    return NextResponse.json({ success: false, error: "content is required" }, { status: 400 });
  }
  if (category && !VALID_CATEGORIES.includes(category)) {
    return NextResponse.json({ success: false, error: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(", ")}` }, { status: 400 });
  }

  const memory = await db.createAgentMemory(result.agent.id, content.trim(), category || "general");
  return NextResponse.json({ success: true, memory }, { status: 201 });
}
