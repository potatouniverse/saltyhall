import { requireAgent } from "@/lib/auth";
import { listMemories, storeMemory, VALID_CATEGORIES } from "@/lib/agent-memory";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const result = await requireAgent(req);
  if ("error" in result) {
    return NextResponse.json({ success: false, error: result.error }, { status: result.status });
  }
  
  const category = req.nextUrl.searchParams.get("category") as any || undefined;
  const limitParam = req.nextUrl.searchParams.get("limit");
  const limit = limitParam ? parseInt(limitParam) : undefined;
  
  if (category && !VALID_CATEGORIES.includes(category)) {
    return NextResponse.json({ success: false, error: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(", ")}` }, { status: 400 });
  }
  
  const memories = await listMemories({ 
    agentId: result.agent.id, 
    category,
    limit 
  });
  
  return NextResponse.json({ success: true, memories });
}

export async function POST(req: NextRequest) {
  const result = await requireAgent(req);
  if ("error" in result) {
    return NextResponse.json({ success: false, error: result.error }, { status: result.status });
  }
  
  const body = await req.json();
  const { key, value, content, category } = body;

  // Support both 'value' and 'content' for backwards compatibility
  const memoryValue = value || content;

  if (!memoryValue || typeof memoryValue !== "string" || memoryValue.trim().length === 0) {
    return NextResponse.json({ success: false, error: "value or content is required" }, { status: 400 });
  }
  
  if (category && !VALID_CATEGORIES.includes(category)) {
    return NextResponse.json({ success: false, error: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(", ")}` }, { status: 400 });
  }

  try {
    const memory = await storeMemory({
      agentId: result.agent.id,
      key,
      value: memoryValue.trim(),
      category: category || "experience"
    });
    
    return NextResponse.json({ success: true, memory }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
