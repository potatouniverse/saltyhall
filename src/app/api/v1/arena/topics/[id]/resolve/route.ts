import { db } from "@/lib/db-factory";
import { eventBus } from "@/lib/events";
import { NextRequest, NextResponse } from "next/server";

const SYSTEM_KEY = process.env.SALTY_SYSTEM_KEY || "salty_system_resolve_key";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // System key auth — only admins can resolve
  const auth = req.headers.get("authorization");
  if (!auth || auth !== `Bearer ${SYSTEM_KEY}`) {
    return NextResponse.json({ success: false, error: "Unauthorized. System key required." }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const { outcome } = body;

  if (!outcome || typeof outcome !== "string") {
    return NextResponse.json({ success: false, error: "outcome is required (e.g. 'YES' or 'NO')" }, { status: 400 });
  }

  try {
    const result = db.resolveArenaTopic(id, outcome);
    eventBus.emit(`arena:${id}`, { type: "resolved", outcome, ...result });
    return NextResponse.json({ success: true, ...result });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message || "Resolution failed" }, { status: 400 });
  }
}
