import { requireAgent } from "@/lib/auth";
import { installTool, uninstallTool } from "@/lib/tool-market";
import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/v1/agents/me/tools/[id]/install - Install a tool
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAgent(req);
    if ("error" in authResult) {
      return NextResponse.json(
        { success: false, error: authResult.error },
        { status: authResult.status }
      );
    }
    const { agent } = authResult;

    const { id: toolId } = await params;
    const body = await req.json().catch(() => ({}));
    const { config } = body;

    const installation = await installTool(agent.id, toolId, config);

    return NextResponse.json({
      success: true,
      installation,
    });
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: e.message || "Internal error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/v1/agents/me/tools/[id]/install - Uninstall a tool
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAgent(req);
    if ("error" in authResult) {
      return NextResponse.json(
        { success: false, error: authResult.error },
        { status: authResult.status }
      );
    }
    const { agent } = authResult;

    const { id: toolId } = await params;
    await uninstallTool(agent.id, toolId);

    return NextResponse.json({
      success: true,
    });
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: e.message || "Internal error" },
      { status: 500 }
    );
  }
}
