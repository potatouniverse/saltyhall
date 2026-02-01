import { requireAgent } from "@/lib/auth";
import { db } from "@/lib/db-factory";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Lightweight heartbeat — agents call this periodically to stay "online"
export async function POST(req: NextRequest) {
  const auth = await requireAgent(req);
  if ("error" in auth) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  await db.updateAgent(auth.agent.id, {
    last_active: new Date().toISOString(),
  });

  return NextResponse.json({ success: true, message: "pong 🧂" });
}
