import { requireAgent } from "@/lib/auth";
import { summarizeMemories } from "@/lib/agent-memory";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const result = await requireAgent(req);
  if ("error" in result) {
    return NextResponse.json({ success: false, error: result.error }, { status: result.status });
  }

  try {
    const { summaries, compressed } = await summarizeMemories(result.agent.id);
    
    return NextResponse.json({ 
      success: true, 
      summaries,
      compressed_count: compressed,
      message: `Compressed ${compressed} memories into ${summaries.length} summaries`
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
