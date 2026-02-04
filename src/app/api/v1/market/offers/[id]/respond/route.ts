import { requireAgent } from "@/lib/auth";
import { db } from "@/lib/db-factory";
import { eventBus } from "@/lib/events";
import { SALT_BURNS } from "@/lib/salt-economics";
import { NextRequest, NextResponse } from "next/server";
import {
  shouldRouteToClawEngineer,
  createTaskFromMarket,
  makeListingExternalId,
  makeAgentExternalId,
  categoryToTaskType,
} from "@/lib/clawengineer-bridge";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const result = await requireAgent(req);
  if ("error" in result) return NextResponse.json({ success: false, error: result.error }, { status: result.status });

  const { id } = await params;
  const offer = await db.getMarketOffer(id);
  if (!offer) return NextResponse.json({ success: false, error: "Offer not found" }, { status: 404 });

  const listing = await db.getMarketListing(offer.listing_id);
  if (!listing) return NextResponse.json({ success: false, error: "Listing not found" }, { status: 404 });
  if (listing.agent_id !== result.agent.id) return NextResponse.json({ success: false, error: "Only the listing owner can respond" }, { status: 403 });

  const body = await req.json();
  const { action, counter_text, counter_price } = body;
  if (!["accept", "reject", "counter"].includes(action)) return NextResponse.json({ success: false, error: "action must be accept, reject, or counter" }, { status: 400 });

  // For instant trades (no acceptance_criteria), transfer Salt immediately on accept
  // For task/service listings (with acceptance_criteria), payment happens after verified delivery
  const hasVerification = !!(listing as any).acceptance_criteria;
  if (action === "accept" && offer.price && !hasVerification) {
    const priceNum = parseInt(offer.price);
    if (!isNaN(priceNum) && priceNum > 0) {
      try {
        // Calculate and burn market commission
        const commission = Math.floor(priceNum * SALT_BURNS.MARKET_COMMISSION);
        const sellerReceives = priceNum - commission;

        await db.transferNacl(offer.agent_id, listing.agent_id, sellerReceives, "trade", `🏪 Market trade: "${listing.title}" — ${sellerReceives} Salt (after ${commission} commission)`);

        if (commission > 0) {
          // Burn commission from buyer separately
          await db.transferNacl(offer.agent_id, null, commission, "burn", `🔥 Market commission on "${listing.title}" — ${commission} Salt dissolved (${SALT_BURNS.MARKET_COMMISSION * 100}%)`);
        }
      } catch (e: any) {
        return NextResponse.json({ success: false, error: `Buyer lacks Salt: ${e.message}` }, { status: 400 });
      }
    }
  }

  const statusMap: Record<string, string> = { accept: "accepted", reject: "rejected", counter: "countered" };
  const resp = await db.respondToMarketOffer(id, statusMap[action], counter_text, counter_price);
  
  // ── CodeTaskRouter: Route code listings to ClawEngineer ──
  let clawEngineerRouted = false;
  if (action === "accept" && shouldRouteToClawEngineer(listing.category || "")) {
    try {
      console.log(`[CodeTaskRouter] Routing ${listing.category} listing ${listing.id} to ClawEngineer`);
      
      // Parse acceptance criteria into array
      let criteria: string[] = [];
      if ((listing as any).acceptance_criteria) {
        try {
          const parsed = JSON.parse((listing as any).acceptance_criteria);
          criteria = Array.isArray(parsed) ? parsed : [String(parsed)];
        } catch {
          criteria = [(listing as any).acceptance_criteria];
        }
      }

      // Get the offerer (worker) agent details
      const workerAgent = await db.getAgentById(offer.agent_id);
      if (!workerAgent) throw new Error("Worker agent not found");

      const clawTask = await createTaskFromMarket({
        external_id: makeListingExternalId(listing.id),
        title: listing.title,
        description: listing.description,
        acceptance_criteria: criteria,
        task_type: categoryToTaskType(listing.category || "code"),
        assigned_agent: {
          external_id: makeAgentExternalId(workerAgent.id),
          name: workerAgent.name,
        },
        sla_hours: 24, // Default 24h deadline
      });

      // Update listing with ClawEngineer task info
      await db.updateMarketListing(listing.id, {
        clawengineer_task_id: clawTask.task_id,
        clawengineer_status: "pending",
        clawengineer_repo_url: clawTask.repo_url,
        clawengineer_deadline: clawTask.deadline,
      });

      clawEngineerRouted = true;
      console.log(`[CodeTaskRouter] Task ${clawTask.task_id} created for listing ${listing.id}`);

      // Notify the offerer with repo details
      eventBus.emit(`agent:${offer.agent_id}`, {
        type: "code_task_assigned",
        listing_id: listing.id,
        listing_title: listing.title,
        task_id: clawTask.task_id,
        repo_url: clawTask.repo_url,
        clone_token: clawTask.clone_token,
        deadline: clawTask.deadline,
      });
    } catch (err: any) {
      // Log error but don't fail the accept - fall back to manual delivery
      console.error(`[CodeTaskRouter] Failed to route to ClawEngineer:`, err.message);
      // Still proceed with normal accept flow
    }
  }

  eventBus.emit(`market:${offer.listing_id}`, { type: "offer_response", action, offer_id: id, result: resp });
  // Notify the offerer about the response
  eventBus.emit(`agent:${offer.agent_id}`, {
    type: "market_offer_response",
    listing_id: offer.listing_id,
    listing_title: listing.title,
    offer_id: id,
    action,
    from: result.agent.name,
    counter_text: counter_text || undefined,
    counter_price: counter_price || undefined,
    requires_delivery: action === "accept" && hasVerification && !clawEngineerRouted,
    clawengineer_routed: clawEngineerRouted,
  });
  return NextResponse.json({ success: true, result: resp, clawengineer_routed: clawEngineerRouted });
}
