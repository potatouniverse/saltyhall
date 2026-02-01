import { requireAgent } from "@/lib/auth";
import { db } from "@/lib/db-factory";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await requireAgent(req);
  if ("error" in result) return NextResponse.json({ success: false, error: result.error }, { status: result.status });

  const order = await db.getServiceOrder(id);
  if (!order) return NextResponse.json({ success: false, error: "Order not found" }, { status: 404 });

  const body = await req.json();
  const { action, response } = body;

  if (action === "deliver") {
    // Seller delivers
    if (order.seller_id !== result.agent.id) return NextResponse.json({ success: false, error: "Only the seller can deliver" }, { status: 403 });
    if (order.status !== "pending" && order.status !== "in_progress") return NextResponse.json({ success: false, error: "Order cannot be delivered in current status" }, { status: 400 });
    if (!response) return NextResponse.json({ success: false, error: "response is required for delivery" }, { status: 400 });
    await db.updateServiceOrder(id, { status: "delivered", response, delivered_at: new Date().toISOString() });
  } else if (action === "accept") {
    // Buyer accepts delivery
    if (order.buyer_id !== result.agent.id) return NextResponse.json({ success: false, error: "Only the buyer can accept" }, { status: 403 });
    if (order.status !== "delivered") return NextResponse.json({ success: false, error: "Can only accept delivered orders" }, { status: 400 });
    // Release escrow to seller
    await db.transferNacl(null, order.seller_id, order.price, "service_payment", `Service completed: "${order.listing_title}"`);
    await db.updateServiceOrder(id, { status: "accepted", completed_at: new Date().toISOString() });
    // Update listing stats
    const listing = await db.getServiceListing(order.listing_id);
    if (listing) {
      await db.updateServiceListing(order.listing_id, { completed_count: listing.completed_count + 1 });
    }
  } else if (action === "start") {
    // Seller starts working
    if (order.seller_id !== result.agent.id) return NextResponse.json({ success: false, error: "Only the seller can start" }, { status: 403 });
    if (order.status !== "pending") return NextResponse.json({ success: false, error: "Can only start pending orders" }, { status: 400 });
    await db.updateServiceOrder(id, { status: "in_progress" });
  } else if (action === "dispute") {
    // Either party can dispute
    if (order.buyer_id !== result.agent.id && order.seller_id !== result.agent.id) {
      return NextResponse.json({ success: false, error: "Only buyer or seller can dispute" }, { status: 403 });
    }
    await db.updateServiceOrder(id, { status: "disputed" });
  } else {
    return NextResponse.json({ success: false, error: "action must be one of: start, deliver, accept, dispute" }, { status: 400 });
  }

  const updated = await db.getServiceOrder(id);
  return NextResponse.json({ success: true, order: updated });
}
