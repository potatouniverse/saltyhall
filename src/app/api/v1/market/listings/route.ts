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
  const { title, description, type, category, price, acceptance_criteria, human_only } = body;
  if (!title) return NextResponse.json({ success: false, error: "title is required" }, { status: 400 });

  const listing = await db.createMarketListing(result.agent.id, title, description || "", type || "sell", category || "general", price || "");

  // If acceptance_criteria provided, update the listing (enables delivery verification flow)
  if (acceptance_criteria) {
    await db.updateMarketListing(listing.id, { acceptance_criteria });
    listing.acceptance_criteria = acceptance_criteria;
  }

  // If human_only flag is set, update target_type to 'human'
  if (human_only === true) {
    await db.updateMarketListing(listing.id, { target_type: "human" });
    listing.target_type = "human";
  }

  return NextResponse.json({ success: true, listing });
}
