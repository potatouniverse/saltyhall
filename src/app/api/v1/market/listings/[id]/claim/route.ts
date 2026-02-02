import { requireAgent, requireUser } from "@/lib/auth";
import { db } from "@/lib/db-factory";
import { eventBus } from "@/lib/events";
import { dispatchWebhook } from "@/lib/webhook";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // Try agent auth first, then human auth
  const agentResult = await requireAgent(req);
  const humanResult = agentResult && "error" in agentResult ? await requireUser(req) : null;

  // If both fail, return error
  if (agentResult && "error" in agentResult && humanResult && "error" in humanResult) {
    return NextResponse.json({ success: false, error: "Authentication required" }, { status: 401 });
  }

  const isAgent = agentResult && !("error" in agentResult);
  const isHuman = humanResult && !("error" in humanResult);

  const { id } = await params;
  const listing = await db.getMarketListing(id);
  if (!listing) return NextResponse.json({ success: false, error: "Listing not found" }, { status: 404 });
  if (listing.status !== "active") return NextResponse.json({ success: false, error: "Listing is not available for claiming" }, { status: 400 });
  if ((listing as any).claimed_by || (listing as any).claimer_human_id) {
    return NextResponse.json({ success: false, error: "Listing is already claimed" }, { status: 409 });
  }

  // Check target_type compatibility
  const targetType = (listing as any).target_type || "any";
  if (targetType === "agent" && isHuman) {
    return NextResponse.json({ success: false, error: "This task is only available for agents" }, { status: 403 });
  }
  if (targetType === "human" && isAgent) {
    return NextResponse.json({ success: false, error: "This task is only available for humans" }, { status: 403 });
  }

  // For agent-posted listings that aren't human_only, use the offer system
  if (listing.poster_type === "agent" && targetType === "any" && isAgent) {
    return NextResponse.json({ success: false, error: "Use /offer for agent-to-agent listings." }, { status: 400 });
  }

  // Claim the listing
  const updates: any = {
    claimed_at: new Date().toISOString(),
    status: "in_progress",
  };

  if (isAgent && agentResult && !("error" in agentResult)) {
    updates.claimed_by = agentResult.agent.id;
  } else if (isHuman && humanResult && !("error" in humanResult)) {
    updates.claimer_human_id = humanResult.user.id;
  }

  await db.updateMarketListing(id, updates);

  // Notify the poster
  if (listing.poster_human_id) {
    // Human poster, notify via event bus
    eventBus.emit(`user:${listing.poster_human_id}`, {
      type: "task_claimed",
      listing_id: id,
      listing_title: listing.title,
      claimer_name: isAgent && agentResult && !("error" in agentResult) ? agentResult.agent.name : "Human",
      claimer_id: isAgent && agentResult && !("error" in agentResult) ? agentResult.agent.id : (humanResult && !("error" in humanResult) ? humanResult.user.id : null),
    });
  } else if (listing.poster_type === "agent") {
    // Agent poster, notify via webhook
    const agent = await db.getAgentById(listing.agent_id);
    if (agent && agent.webhook_url) {
      await dispatchWebhook(agent, "market.task_claimed", {
        listing_id: id,
        listing_title: listing.title,
        claimer_type: isAgent ? "agent" : "human",
        claimer_name: isAgent && agentResult && !("error" in agentResult) ? agentResult.agent.name : (humanResult && !("error" in humanResult) ? humanResult.user.display_name || "Human" : "Unknown"),
      });
    }
  }

  return NextResponse.json({
    success: true,
    message: `Task "${listing.title}" claimed successfully. Submit your work via POST /api/v1/market/listings/${id}/submit`,
    listing_id: id,
  });
}
