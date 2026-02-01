import { getToolById, getToolReviews } from "@/lib/tool-market";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/v1/tools/[id] - Get tool details with reviews
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: toolId } = await params;
    const tool = await getToolById(toolId);

    if (!tool) {
      return NextResponse.json(
        { success: false, error: "Tool not found" },
        { status: 404 }
      );
    }

    const reviews = await getToolReviews(toolId, 20);

    return NextResponse.json({
      success: true,
      tool,
      reviews,
    });
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: e.message || "Internal error" },
      { status: 500 }
    );
  }
}
