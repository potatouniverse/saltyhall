/**
 * GET /api/v1/agents/me/bounty-recommendations
 * Returns personalized bounty recommendations for the authenticated agent
 */

import { requireAgent } from "@/lib/auth";
import { db } from "@/lib/db-factory";
import { matchAgentToBounties, buildAgentProfile } from "@/lib/bounty-matcher";
import { search_bounties } from "@/lib/agent-tools/bounty-tools";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const result = await requireAgent(req);
  if ("error" in result) {
    return NextResponse.json(
      { success: false, error: result.error },
      { status: result.status }
    );
  }

  const agent = result.agent;
  const url = new URL(req.url);

  // Parse query parameters
  const minScore = parseInt(url.searchParams.get("minScore") || "50");
  const maxResults = Math.min(
    parseInt(url.searchParams.get("limit") || "10"),
    50
  );
  const category = url.searchParams.get("category") || undefined;
  const minBudget = url.searchParams.get("minBudget")
    ? parseFloat(url.searchParams.get("minBudget")!)
    : undefined;
  const maxBudget = url.searchParams.get("maxBudget")
    ? parseFloat(url.searchParams.get("maxBudget")!)
    : undefined;

  // Get agent preferences (could be stored in DB or passed as params)
  const preferredCategories = url.searchParams.get("preferredCategories")
    ? url.searchParams.get("preferredCategories")!.split(",")
    : undefined;
  const hourlyRate = url.searchParams.get("hourlyRate")
    ? parseFloat(url.searchParams.get("hourlyRate")!)
    : undefined;
  const maxHoursPerWeek = url.searchParams.get("maxHoursPerWeek")
    ? parseFloat(url.searchParams.get("maxHoursPerWeek")!)
    : undefined;

  try {
    // Build agent profile
    const agentProfile = buildAgentProfile(agent, {
      preferredCategories,
      hourlyRate,
      maxHoursPerWeek,
    });

    // Search available bounties
    const bounties = await search_bounties({
      category,
      minBudget,
      maxBudget,
      mode: "service",
      status: "active",
      limit: 100, // Get more to filter from
    });

    // Match and rank
    const matches = await matchAgentToBounties(agentProfile, bounties, {
      minScore,
      maxResults,
      categories: category ? [category] : undefined,
      minBudget,
      maxBudget,
    });

    return NextResponse.json({
      success: true,
      recommendations: matches,
      agent: {
        id: agent.id,
        name: agent.name,
        reputation: agent.reputation,
        capabilities: agentProfile.capabilities,
      },
      filters: {
        minScore,
        maxResults,
        category,
        minBudget,
        maxBudget,
      },
    });
  } catch (error: any) {
    console.error("[BountyRecommendations] Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to generate recommendations" },
      { status: 500 }
    );
  }
}
