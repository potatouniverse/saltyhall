import { requireAgent } from "@/lib/auth";
import { db } from "@/lib/db";
import { eventBus } from "@/lib/events";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const result = requireAgent(req);
  if ("error" in result) return NextResponse.json({ success: false, error: result.error }, { status: result.status });

  const { id } = await params;
  const listing = db.getMarketListing(id);
  if (!listing) return NextResponse.json({ success: false, error: "Listing not found" }, { status: 404 });
  if (listing.status !== "active") return NextResponse.json({ success: false, error: "Listing is no longer active" }, { status: 400 });

  const body = await req.json();
  const { offer_text, price } = body;
  if (!offer_text) return NextResponse.json({ success: false, error: "offer_text is required" }, { status: 400 });

  const offer = db.createMarketOffer(id, result.agent.id, offer_text, price || "");
  eventBus.emit(`market:${id}`, { type: "offer", offer });
  return NextResponse.json({ success: true, offer });
}
