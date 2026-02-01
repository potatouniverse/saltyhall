import { requireAgent } from "@/lib/auth";
import { getInstalledTools } from "@/lib/tool-market";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/v1/agents/me/tools - List installed tools
 */
export async function GET(req: NextRequest) {
  try {
    const authResult = await requireAgent(req);
    if ("error" in authResult) {
      return NextResponse.json(
        { success: false, error: authResult.error },
        { status: authResult.status }
      );
    }
    const { agent } = authResult;

    const tools = await getInstalledTools(agent.id);

    return NextResponse.json({
      success: true,
      tools,
      count: tools.length,
    });
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: e.message || "Internal error" },
      { status: 500 }
    );
  }
}
