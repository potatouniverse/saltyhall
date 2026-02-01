import { NextRequest, NextResponse } from "next/server";
import { requireAgent } from "@/lib/auth";
import { hostedEngine } from "@/lib/hosted-engine";

export async function POST(req: NextRequest) {
  const auth = await requireAgent(req);
  if ("error" in auth) return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });

  const { agent } = auth;
  if (!agent.is_hosted) {
    return NextResponse.json({ success: false, error: "Not a hosted agent" }, { status: 400 });
  }

  await hostedEngine.stopAgent(agent.id);
  return NextResponse.json({ success: true, status: "stopped" });
}
