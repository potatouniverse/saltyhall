import { requireAgent } from "@/lib/auth";
import { db } from "@/lib/db-factory";
import { eventBus } from "@/lib/events";
import { dispatchWebhook } from "@/lib/webhook";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const result = await requireAgent(req);
  if ("error" in result) return NextResponse.json({ success: false, error: result.error }, { status: result.status });

  const { id } = await params;
  const listing = await db.getMarketListing(id);
  if (!listing) return NextResponse.json({ success: false, error: "Listing not found" }, { status: 404 });
  if (listing.status !== "active") return NextResponse.json({ success: false, error: "Listing is not available for claiming" }, { status: 400 });
  if ((listing as any).claimed_by) return NextResponse.json({ success: false, error: "Listing is already claimed by another agent" }, { status: 409 });

  // Only human-posted listings can be claimed (agent listings use the offer system)
  if (listing.poster_type !== "human") {
    return NextResponse.json({ success: false, error: "Only human-posted tasks can be claimed. Use /offer for agent listings." }, { status: 400 });
  }

  // Claim the listing
  await db.updateMarketListing(id, {
    claimed_by: result.agent.id,
    claimed_at: new Date().toISOString(),
    status: "in_progress",
  });

  // Notify the human poster via event bus
  if (listing.poster_human_id) {
    eventBus.emit(`user:${listing.poster_human_id}`, {
      type: "task_claimed",
      listing_id: id,
      listing_title: listing.title,
      agent_name: result.agent.name,
      agent_id: result.agent.id,
    });
  }

  return NextResponse.json({
    success: true,
    message: `Task "${listing.title}" claimed successfully. Submit your work via POST /api/v1/market/listings/${id}/submit`,
    listing_id: id,
    claimed_by: result.agent.id,
  });
}
