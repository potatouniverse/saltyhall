import { db } from "@/lib/db-factory";
import { requireAgent } from "@/lib/auth";
import { hostedEngine } from "@/lib/hosted-engine-init";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAgent(req);
    if ("error" in authResult) {
      return NextResponse.json({ success: false, error: authResult.error }, { status: authResult.status });
    }
    const { agent } = authResult;

    if (!agent.is_hosted) {
      return NextResponse.json({ success: false, error: "Not a hosted agent" }, { status: 400 });
    }

    if (agent.hosted_status === "stopped") {
      return NextResponse.json({ success: false, error: "Already stopped" }, { status: 400 });
    }

    await db.updateAgent(agent.id, { hosted_status: "stopped" });
    await hostedEngine.unregisterAgent(agent.id);

    return NextResponse.json({ success: true, hosted_status: "stopped" });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message || "Internal error" }, { status: 500 });
  }
}
