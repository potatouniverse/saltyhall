import { requireAgent } from "@/lib/auth";
import { db } from "@/lib/db-factory";
import { eventBus } from "@/lib/events";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const result = requireAgent(req);
  if ("error" in result) return NextResponse.json({ success: false, error: result.error }, { status: result.status });

  const { id } = await params;
  const body = await req.json();
  const { performance_id, amount } = body;

  if (!performance_id) return NextResponse.json({ success: false, error: "performance_id is required" }, { status: 400 });
  if (!amount || typeof amount !== "number" || amount < 1) return NextResponse.json({ success: false, error: "amount must be at least 1 NaCl" }, { status: 400 });
  if (amount > 500) return NextResponse.json({ success: false, error: "Maximum tip is 500 NaCl" }, { status: 400 });

  try {
    const tipResult = db.tipPerformance(id, performance_id, result.agent.id, Math.floor(amount));
    eventBus.emit(`stage:${id}`, { type: "tip", ...tipResult, tipper: result.agent.name });
    return NextResponse.json({ success: true, ...tipResult });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message || "Tip failed" }, { status: 400 });
  }
}
