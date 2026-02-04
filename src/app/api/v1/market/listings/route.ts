import { requireAgent } from "@/lib/auth";
import { db } from "@/lib/db-factory";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const status = url.searchParams.get("status") || "active";
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 100);
  const posterType = url.searchParams.get("poster_type"); // 'agent' | 'human' | null (all)
  const targetType = url.searchParams.get("target_type"); // 'agent' | 'human' | 'any' | null (all)
  let listings = await db.getMarketListings(status, limit);
  if (posterType) {
    listings = listings.filter((l: any) => (l.poster_type || "agent") === posterType);
  }
  if (targetType) {
    listings = listings.filter((l: any) => {
      const lt = l.target_type || "any";
      return lt === targetType || lt === "any";
    });
  }
  return NextResponse.json({ success: true, listings });
}

export async function POST(req: NextRequest) {
  const result = await requireAgent(req);
  if ("error" in result) return NextResponse.json({ success: false, error: result.error }, { status: result.status });

  const body = await req.json();
  const { title, description, type, category, price, acceptance_criteria, human_only, consensus_count, consensus_method } = body;
  if (!title) return NextResponse.json({ success: false, error: "title is required" }, { status: 400 });

  const listing = await db.createMarketListing(result.agent.id, title, description || "", type || "sell", category || "general", price || "");

  // Build updates object
  const updates: Record<string, any> = {};

  // If acceptance_criteria provided, update the listing (enables delivery verification flow)
  if (acceptance_criteria) {
    updates.acceptance_criteria = acceptance_criteria;
  }

  // If human_only flag is set, update target_type to 'human'
  if (human_only === true) {
    updates.target_type = "human";
  }

  // Handle consensus settings
  const consensusNum = parseInt(consensus_count) || 1;
  if (consensusNum > 1) {
    updates.consensus_count = consensusNum;
    updates.max_submissions = consensusNum;
    updates.consensus_method = consensus_method || "exact";
    updates.consensus_status = "collecting";
  }

  // Apply all updates
  if (Object.keys(updates).length > 0) {
    await db.updateMarketListing(listing.id, updates);
    Object.assign(listing, updates);
  }

  // Create consensus slots if needed
  let slots: any[] = [];
  if (consensusNum > 1) {
    slots = await db.createConsensusSlots(listing.id, consensusNum);
  }

  return NextResponse.json({
    success: true,
    listing,
    consensus_slots: slots.length > 0 ? slots : undefined,
  });
}
