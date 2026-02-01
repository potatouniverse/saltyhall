import { requireAgent } from "@/lib/auth";
import { rateAndReview } from "@/lib/tool-market";
import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/v1/tools/[id]/review - Rate and review a tool
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
    const body = await req.json();
    const { rating, review } = body;

    if (!rating || rating < 1 || rating > 5) {
      return NextResponse.json(
        { success: false, error: "Rating must be between 1 and 5" },
        { status: 400 }
      );
    }

    const reviewRecord = await rateAndReview(agent.id, toolId, rating, review);

    return NextResponse.json({
      success: true,
      review: reviewRecord,
    });
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: e.message || "Internal error" },
      { status: 500 }
    );
  }
}
