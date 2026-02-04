/**
 * POST /api/webhooks/clawengineer
 * 
 * Receives task state change webhooks from ClawEngineer.
 * Events: task.verified, task.failed, task.timeout, task.submitted, task.claimed
 * 
 * On task.verified → complete the market listing, transfer Salt (or trigger USDC release)
 * On task.failed → notify agents, allow retry
 * On task.timeout → release the listing back to market
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db-factory";
import { eventBus } from "@/lib/events";
import type { ClawEngineerWebhookEvent } from "@/lib/clawengineer-bridge";
import { parseListingExternalId } from "@/lib/clawengineer-bridge";
import { releaseEscrow } from "@/lib/saltdig-client";

const WEBHOOK_SECRET = process.env.CLAWENGINEER_WEBHOOK_SECRET || '';

function verifyWebhookSecret(req: NextRequest): boolean {
  if (!WEBHOOK_SECRET) {
    console.warn('[webhook/clawengineer] CLAWENGINEER_WEBHOOK_SECRET not configured — skipping verification');
    return true; // Allow in dev
  }
  const provided = req.headers.get('x-webhook-secret');
  return provided === WEBHOOK_SECRET;
}

export async function POST(req: NextRequest) {
  // Verify webhook authenticity
  if (!verifyWebhookSecret(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let event: ClawEngineerWebhookEvent;
  try {
    event = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Validate required fields
  if (!event.event || !event.task_id || !event.external_id) {
    return NextResponse.json({ error: 'Missing required fields: event, task_id, external_id' }, { status: 400 });
  }

  // Extract SaltyHall listing ID from external_id
  const listingId = parseListingExternalId(event.external_id);
  if (!listingId) {
    return NextResponse.json({ error: `Invalid external_id format: ${event.external_id}` }, { status: 400 });
  }

  console.log(`[webhook/clawengineer] Received ${event.event} for task=${event.task_id} listing=${listingId}`);

  try {
    switch (event.event) {
      case 'task.verified':
        await handleTaskVerified(db, listingId, event);
        break;

      case 'task.failed':
        await handleTaskFailed(db, listingId, event);
        break;

      case 'task.timeout':
        await handleTaskTimeout(db, listingId, event);
        break;

      case 'task.submitted':
        await handleTaskSubmitted(db, listingId, event);
        break;

      case 'task.claimed':
        // Informational — update listing metadata
        console.log(`[webhook/clawengineer] Task ${event.task_id} claimed`);
        break;

      default:
        console.warn(`[webhook/clawengineer] Unknown event type: ${event.event}`);
    }

    return NextResponse.json({ success: true, event: event.event });
  } catch (error) {
    console.error(`[webhook/clawengineer] Error handling ${event.event}:`, error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ── Event Handlers ──

async function handleTaskVerified(
  db: any,
  listingId: string,
  event: ClawEngineerWebhookEvent,
) {
  console.log(`[webhook/clawengineer] Task verified! Completing listing ${listingId}`);

  // Get the listing to find buyer/seller
  const listing = await db.getMarketListingById?.(listingId);
  if (!listing) {
    console.error(`[webhook/clawengineer] Listing ${listingId} not found`);
    return;
  }

  // Find the accepted offer
  const offers = await db.getMarketOffers?.(listingId);
  const acceptedOffer = offers?.find((o: any) => o.status === 'accepted');

  if (!acceptedOffer) {
    console.error(`[webhook/clawengineer] No accepted offer for listing ${listingId}`);
    return;
  }

  // Transfer Salt from buyer to seller
  const price = listing.price || acceptedOffer.price;
  if (price && price > 0) {
    try {
      await db.transferNacl?.(listing.agent_id, acceptedOffer.agent_id, price, 
        `Code task completed: ${listing.title} (ClawEngineer verified)`);
      console.log(`[webhook/clawengineer] Transferred ${price} Salt for listing ${listingId}`);
    } catch (err) {
      console.error(`[webhook/clawengineer] Salt transfer failed:`, err);
    }
  }

  // Update listing status to completed
  await db.updateMarketListing?.(listingId, {
    status: 'completed',
    completed_at: new Date().toISOString(),
    clawengineer_evidence: JSON.stringify(event.evidence || {}),
  });

  // Emit SSE event for real-time UI updates
  eventBus.emit('market', {
    type: 'listing_completed',
    listing_id: listingId,
    verified_by: 'clawengineer',
    evidence: event.evidence,
  });

  // If USDC listing, trigger SaltDig escrow release
  if ((listing as any).currency === 'usdc' && (listing as any).escrow_id) {
    try {
      const evidenceHash = event.evidence?.overall_score 
        ? `clawengineer:${event.task_id}:${event.evidence.overall_score}`
        : undefined;
      
      await releaseEscrow({
        escrow_id: (listing as any).escrow_id,
        recipient_agent_id: acceptedOffer.agent_id,
        evidence_hash: evidenceHash,
      });
      
      console.log(`[webhook/clawengineer] USDC escrow ${(listing as any).escrow_id} released to ${acceptedOffer.agent_id}`);
    } catch (err: any) {
      console.error(`[webhook/clawengineer] USDC release failed:`, err.message);
      // Log but don't fail — Salt transfer already succeeded
    }
  }
}

async function handleTaskFailed(
  db: any,
  listingId: string,
  event: ClawEngineerWebhookEvent,
) {
  console.log(`[webhook/clawengineer] Task failed for listing ${listingId}`);

  // Update listing metadata (don't complete — agent can retry)
  await db.updateMarketListing?.(listingId, {
    clawengineer_status: 'failed',
    clawengineer_evidence: JSON.stringify(event.evidence || {}),
  });

  // Notify via SSE
  eventBus.emit('market', {
    type: 'task_verification_failed',
    listing_id: listingId,
    evidence: event.evidence,
  });
}

async function handleTaskTimeout(
  db: any,
  listingId: string,
  event: ClawEngineerWebhookEvent,
) {
  console.log(`[webhook/clawengineer] Task timed out for listing ${listingId}`);

  // Release the listing back to open
  await db.updateMarketListing?.(listingId, {
    status: 'active',
    clawengineer_status: 'timeout',
    clawengineer_task_id: null,
  });

  // Cancel the accepted offer
  const offers = await db.getMarketOffers?.(listingId);
  const acceptedOffer = offers?.find((o: any) => o.status === 'accepted');
  if (acceptedOffer) {
    await db.updateMarketOffer?.(acceptedOffer.id, { status: 'cancelled' });
  }

  eventBus.emit('market', {
    type: 'task_timeout',
    listing_id: listingId,
  });
}

async function handleTaskSubmitted(
  db: any,
  listingId: string,
  event: ClawEngineerWebhookEvent,
) {
  console.log(`[webhook/clawengineer] Task submitted for listing ${listingId} — verification in progress`);

  await db.updateMarketListing?.(listingId, {
    clawengineer_status: 'verifying',
  });

  eventBus.emit('market', {
    type: 'task_submitted',
    listing_id: listingId,
  });
}
