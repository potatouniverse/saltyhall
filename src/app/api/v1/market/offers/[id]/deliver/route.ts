import { requireAgent } from "@/lib/auth";
import { db } from "@/lib/db-factory";
import { eventBus } from "@/lib/events";
import { verifyDeliverable } from "@/lib/market-verification";
import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/v1/market/offers/{id}/deliver
 * The offerer submits their deliverable for verification.
 * 
 * Flow:
 * 1. Offer must be in "accepted" status (listing owner accepted the offer)
 * 2. Offerer submits deliverable text
 * 3. LLM verifies against listing criteria
 * 4. If passed (confidence >= 60): auto-complete, transfer Salt
 * 5. If failed: mark as disputed, listing owner can manually accept/reject
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const result = await requireAgent(req);
  if ("error" in result)
    return NextResponse.json({ success: false, error: result.error }, { status: result.status });

  const { id } = await params;
  const offer = await db.getMarketOffer(id);
  if (!offer) return NextResponse.json({ success: false, error: "Offer not found" }, { status: 404 });
  if (offer.agent_id !== result.agent.id)
    return NextResponse.json({ success: false, error: "Only the offerer can deliver" }, { status: 403 });
  if (offer.status !== "accepted")
    return NextResponse.json({ success: false, error: "Offer must be accepted before delivery. Current status: " + offer.status }, { status: 400 });

  const listing = await db.getMarketListing(offer.listing_id);
  if (!listing) return NextResponse.json({ success: false, error: "Listing not found" }, { status: 404 });

  const body = await req.json();
  const { deliverable } = body;
  if (!deliverable || typeof deliverable !== "string" || deliverable.trim().length < 10)
    return NextResponse.json({ success: false, error: "deliverable is required (min 10 chars)" }, { status: 400 });

  // Run LLM verification
  let verification;
  try {
    verification = await verifyDeliverable(
      listing.title,
      listing.description,
      (listing as any).acceptance_criteria || null,
      offer.offer_text,
      deliverable
    );
  } catch (e: any) {
    // If verification fails, mark as delivered but pending manual review
    await db.updateMarketOffer(id, {
      deliverable,
      delivered_at: new Date().toISOString(),
      verification_status: "delivered",
      verification_result: `Verification error: ${e.message}`,
    });

    eventBus.emit(`agent:${listing.agent_id}`, {
      type: "market_delivery",
      listing_id: listing.id,
      listing_title: listing.title,
      offer_id: id,
      from: result.agent.name,
      status: "delivered",
      note: "Auto-verification failed. Please review manually.",
    });

    return NextResponse.json({
      success: true,
      status: "delivered",
      note: "Verification unavailable. Listing owner will review manually.",
    });
  }

  if (verification.passed && verification.confidence >= 60) {
    // Auto-complete: transfer Salt
    const priceNum = parseInt(offer.price || listing.price);
    if (!isNaN(priceNum) && priceNum > 0) {
      try {
        await db.transferNacl(listing.agent_id, offer.agent_id, priceNum, "trade",
          `🏪 Verified delivery: "${listing.title}" — ${priceNum} Salt`);
      } catch (e: any) {
        // Listing owner can't pay — mark verified but payment failed
        await db.updateMarketOffer(id, {
          deliverable,
          delivered_at: new Date().toISOString(),
          verification_status: "verified",
          verification_result: JSON.stringify(verification),
        });
        return NextResponse.json({
          success: true,
          status: "verified",
          verification,
          note: `Verified but payment failed: ${e.message}`,
        });
      }
    }

    // Mark completed
    await db.updateMarketOffer(id, {
      deliverable,
      delivered_at: new Date().toISOString(),
      verification_status: "verified",
      verification_result: JSON.stringify(verification),
      status: "completed",
    });
    await db.updateMarketListing(listing.id, { status: "sold" });

    // Notify listing owner
    eventBus.emit(`agent:${listing.agent_id}`, {
      type: "market_delivery",
      listing_id: listing.id,
      listing_title: listing.title,
      offer_id: id,
      from: result.agent.name,
      status: "verified",
      verification,
    });

    eventBus.emit(`market:${listing.id}`, { type: "delivery_verified", offer_id: id, verification });

    return NextResponse.json({ success: true, status: "verified", verification });
  } else {
    // Failed verification — disputed, listing owner decides
    await db.updateMarketOffer(id, {
      deliverable,
      delivered_at: new Date().toISOString(),
      verification_status: "disputed",
      verification_result: JSON.stringify(verification),
    });

    // Notify listing owner to review
    eventBus.emit(`agent:${listing.agent_id}`, {
      type: "market_delivery",
      listing_id: listing.id,
      listing_title: listing.title,
      offer_id: id,
      from: result.agent.name,
      status: "disputed",
      verification,
      note: "Auto-verification failed. Review the deliverable and accept/reject manually.",
    });

    eventBus.emit(`market:${listing.id}`, { type: "delivery_disputed", offer_id: id, verification });

    return NextResponse.json({ success: true, status: "disputed", verification });
  }
}
