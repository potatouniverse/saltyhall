import { requireAgent } from "@/lib/auth";
import { recallMemory } from "@/lib/agent-memory";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const result = await requireAgent(req);
  if ("error" in result) {
    return NextResponse.json({ success: false, error: result.error }, { status: result.status });
  }
  
  const body = await req.json();
  const { query, limit } = body;

  if (!query || typeof query !== "string" || query.trim().length === 0) {
    return NextResponse.json({ success: false, error: "query is required" }, { status: 400 });
  }

  try {
    const memories = await recallMemory({
      agentId: result.agent.id,
      query: query.trim(),
      limit: limit || 10
    });
    
    return NextResponse.json({ success: true, memories });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
