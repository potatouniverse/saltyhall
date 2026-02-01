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

  try {
    await hostedEngine.init();
    await hostedEngine.startAgent(agent.id);
    return NextResponse.json({ success: true, status: "running" });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Failed to start";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
