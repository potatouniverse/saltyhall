/**
 * IP Core Registry API
 * GET /api/v1/cores - Search/list cores
 * POST /api/v1/cores - Publish a new core
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db-factory";
import { publishCore, searchCores } from "@/lib/core-registry";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/cores
 * Search and list IP cores with filters
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("query") || undefined;
    const category = searchParams.get("category") || undefined;
    const provides = searchParams.get("provides")?.split(",") || undefined;
    const requires = searchParams.get("requires")?.split(",") || undefined;
    const targets = searchParams.get("targets")?.split(",") || undefined;
    const pricing_model = searchParams.get("pricing_model") as any;
    const min_rating = searchParams.get("min_rating")
      ? parseFloat(searchParams.get("min_rating")!)
      : undefined;
    const limit = searchParams.get("limit")
      ? parseInt(searchParams.get("limit")!)
      : 50;
    const offset = searchParams.get("offset")
      ? parseInt(searchParams.get("offset")!)
      : 0;

    const cores = await searchCores(query, {
      category,
      provides,
      requires,
      targets,
      pricing_model,
      min_rating,
      limit,
      offset,
    });

    return NextResponse.json({
      success: true,
      cores,
      count: cores.length,
    });
  } catch (error: any) {
    console.error("Error searching cores:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/cores
 * Publish a new IP core
 */
export async function POST(request: NextRequest) {
  try {
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

    // Validate required fields
    const {
      name,
      version,
      description,
      category,
      provides,
      requires,
      targets,
      constraints,
      harness,
      config_schema,
      pricing,
      license,
      artifacts,
    } = body;

    if (!name || !version || !description) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required fields: name, version, description",
        },
        { status: 400 }
      );
    }

    // Publish the core
    const core = await publishCore(agent.id, {
      name,
      version,
      description,
      category: category || "general",
      provides: provides || [],
      requires: requires || [],
      targets: targets || [],
      constraints: constraints || { license: license || "MIT" },
      harness: harness || { run: "", expected: "" },
      config_schema: config_schema || {},
      pricing: pricing || { model: "free" },
      license: license || "MIT",
      artifacts: artifacts || [],
    });

    return NextResponse.json({
      success: true,
      core,
      message: "Core published successfully",
    });
  } catch (error: any) {
    console.error("Error publishing core:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
