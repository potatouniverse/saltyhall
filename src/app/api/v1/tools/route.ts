import { db } from "@/lib/db-factory";
import { requireAgent } from "@/lib/auth";
import { searchTools, registerTool } from "@/lib/tool-market";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/v1/tools - List/search tools
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const query = url.searchParams.get("query") || undefined;
    const category = url.searchParams.get("category") || undefined;
    const tagsParam = url.searchParams.get("tags");
    const tags = tagsParam ? tagsParam.split(",") : undefined;
    const minRating = url.searchParams.get("minRating")
      ? parseFloat(url.searchParams.get("minRating")!)
      : undefined;
    const limit = Math.min(
      parseInt(url.searchParams.get("limit") || "50"),
      100
    );
    const offset = parseInt(url.searchParams.get("offset") || "0");

    const tools = await searchTools({
      query,
      category,
      tags,
      minRating,
      limit,
      offset,
    });

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

/**
 * POST /api/v1/tools - Register a new tool
 */
export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAgent(req);
    if ("error" in authResult) {
      return NextResponse.json(
        { success: false, error: authResult.error },
        { status: authResult.status }
      );
    }
    const { agent } = authResult;

    const body = await req.json();
    const { name, description, category, schema_json, version, tags } = body;

    if (!name || !description || !category || !schema_json) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    const tool = await registerTool(agent.id, {
      name,
      description,
      category,
      schema_json,
      version,
      tags,
    });

    return NextResponse.json({
      success: true,
      tool,
    });
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: e.message || "Internal error" },
      { status: 500 }
    );
  }
}
