/**
 * Core Detail API
 * GET /api/v1/cores/[id] - Get full core details with reviews and stats
 */

import { NextRequest, NextResponse } from "next/server";
import { getCoreDetail } from "@/lib/core-registry";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/cores/[id]
 * Get full core details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const coreDetail = await getCoreDetail(id);

    if (!coreDetail) {
      return NextResponse.json(
        { success: false, error: "Core not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      ...coreDetail,
    });
  } catch (error: any) {
    console.error("Error fetching core detail:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
