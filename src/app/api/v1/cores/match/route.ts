/**
 * Core Matching API
 * POST /api/v1/cores/match - Auto-match cores for a project graph
 */

import { NextRequest, NextResponse } from "next/server";
import { matchCoresForProject, generateAdapterTasks } from "@/lib/core-registry";

export const dynamic = "force-dynamic";

/**
 * POST /api/v1/cores/match
 * Auto-match cores for a project task graph
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { project_graph, generate_adapters } = body;

    if (!project_graph || !project_graph.nodes) {
      return NextResponse.json(
        { success: false, error: "Missing or invalid project_graph" },
        { status: 400 }
      );
    }

    // Match cores to nodes
    const matches = await matchCoresForProject(project_graph);

    // Convert Map to object for JSON serialization
    const matchesObj: Record<string, any> = {};
    for (const [nodeId, coreMatches] of matches.entries()) {
      matchesObj[nodeId] = coreMatches;
    }

    // Optionally generate adapter tasks
    let adapters: any[] = [];
    if (generate_adapters) {
      adapters = await generateAdapterTasks(project_graph, matches);
    }

    return NextResponse.json({
      success: true,
      matches: matchesObj,
      adapters: generate_adapters ? adapters : undefined,
    });
  } catch (error: any) {
    console.error("Error matching cores:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
