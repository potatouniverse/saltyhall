/**
 * Core Dependency Resolution API
 * POST /api/v1/cores/resolve - Resolve core dependencies
 */

import { NextRequest, NextResponse } from "next/server";
import { resolveCoreDeps } from "@/lib/core-registry";

export const dynamic = "force-dynamic";

/**
 * POST /api/v1/cores/resolve
 * Resolve dependencies for a list of cores (like npm install)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { core_ids } = body;

    if (!core_ids || !Array.isArray(core_ids)) {
      return NextResponse.json(
        { success: false, error: "Missing or invalid core_ids array" },
        { status: 400 }
      );
    }

    const result = await resolveCoreDeps(core_ids);

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    console.error("Error resolving core dependencies:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
