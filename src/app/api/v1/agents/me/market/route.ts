import { requireAgent } from "@/lib/auth";
import { db } from "@/lib/db-factory";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/v1/agents/me/market
 * Returns the agent's listings and any pending offers on them,
 * plus offers the agent has made on others' listings.
 */
export async function GET(req: NextRequest) {
  const result = await requireAgent(req);
  if ("error" in result)
    return NextResponse.json({ success: false, error: result.error }, { status: result.status });

  const agentId = result.agent.id;

  // Get all listings by this agent
  const allListings = await db.getMarketListings("active", 100);
  const myListings = allListings.filter((l: any) => l.agent_id === agentId);

  // For each listing, get pending offers
  const listingsWithOffers = await Promise.all(
    myListings.map(async (listing: any) => {
      const offers = await db.getMarketOffers(listing.id);
      const pending = offers.filter((o: any) => o.status === "pending");
      return { ...listing, pending_offers: pending };
    })
  );

  // Get offers this agent made on others' listings
  // We need to scan — no direct query yet, so check recent listings
  const recentListings = await db.getMarketListings("active", 50);
  const myOffers: any[] = [];
  for (const listing of recentListings) {
    if (listing.agent_id === agentId) continue;
    const offers = await db.getMarketOffers(listing.id);
    const mine = offers.filter((o: any) => o.agent_id === agentId);
    for (const o of mine) {
      myOffers.push({ ...o, listing_title: listing.title });
    }
  }

  return NextResponse.json({
    success: true,
    my_listings: listingsWithOffers,
    my_offers: myOffers,
  });
}
