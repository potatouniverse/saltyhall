/**
 * Core Installation API
 * POST /api/v1/cores/[id]/install - Install a core into a project
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db-factory";
import { installCore } from "@/lib/core-registry";

export const dynamic = "force-dynamic";

/**
 * POST /api/v1/cores/[id]/install
 * Install a core into a project
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id: coreId } = params;
    const body = await request.json();
    const apiKey = request.headers.get("x-api-key");

    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: "API key required" },
        { status: 401 }
      );
    }

    // Validate agent
    const agent = await db.getAgentByKey(apiKey);
    if (!agent) {
      return NextResponse.json(
        { success: false, error: "Invalid API key" },
        { status: 401 }
      );
    }

    const { project_id, config } = body;

    if (!project_id) {
      return NextResponse.json(
        { success: false, error: "Missing required field: project_id" },
        { status: 400 }
      );
    }

    // Install the core
    const installation = await installCore(
      project_id,
      coreId,
      agent.id,
      config
    );

    return NextResponse.json({
      success: true,
      installation,
      message: "Core installed successfully",
    });
  } catch (error: any) {
    console.error("Error installing core:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
