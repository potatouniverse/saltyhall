import { requireAgent } from "@/lib/auth";
import { db } from "@/lib/db-factory";
import { evaluateConsensus, calculatePayouts, type Submission } from "@/lib/consensus";
import { dispatchWebhook } from "@/lib/webhook";
import { NextRequest, NextResponse } from "next/server";

// GET: View consensus status and slots
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const listing = await db.getMarketListing(id);
  if (!listing) {
    return NextResponse.json({ success: false, error: "Listing not found" }, { status: 404 });
  }

  const consensusCount = (listing as any).consensus_count || 1;
  if (consensusCount <= 1) {
    return NextResponse.json({ success: false, error: "This is not a consensus task" }, { status: 400 });
  }

  const slots = await db.getConsensusSlots(id);
  const consensusResult = (listing as any).consensus_result
    ? JSON.parse((listing as any).consensus_result)
    : null;

  return NextResponse.json({
    success: true,
    listing_id: id,
    consensus_count: consensusCount,
    consensus_method: (listing as any).consensus_method || "exact",
    consensus_status: (listing as any).consensus_status,
    consensus_result: consensusResult,
    slots: slots.map((s: any) => ({
      slot_number: s.slot_number,
      status: s.status,
      worker_type: s.worker_type,
      payout_amount: s.payout_amount,
      has_submission: !!s.submission_id,
    })),
  });
}

// POST: Manually trigger consensus evaluation (poster only)
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const result = await requireAgent(req);
  if ("error" in result) {
    return NextResponse.json({ success: false, error: result.error }, { status: result.status });
  }

  const { id } = await params;
  const listing = await db.getMarketListing(id);
  if (!listing) {
    return NextResponse.json({ success: false, error: "Listing not found" }, { status: 404 });
  }

  // Only poster can trigger evaluation
  if (listing.agent_id !== result.agent.id) {
    return NextResponse.json({ success: false, error: "Only the task poster can trigger evaluation" }, { status: 403 });
  }

  const consensusCount = (listing as any).consensus_count || 1;
  if (consensusCount <= 1) {
    return NextResponse.json({ success: false, error: "This is not a consensus task" }, { status: 400 });
  }

  const consensusStatus = (listing as any).consensus_status;
  if (consensusStatus === "achieved" || consensusStatus === "failed") {
    const existingResult = (listing as any).consensus_result
      ? JSON.parse((listing as any).consensus_result)
      : null;
    return NextResponse.json({
      success: true,
      message: `Consensus already ${consensusStatus}`,
      consensus_result: existingResult,
    });
  }

  // Get slots and submissions
  const slots = await db.getConsensusSlots(id);
  const submittedSlots = slots.filter((s: any) => s.status === "submitted");

  if (submittedSlots.length < 2) {
    return NextResponse.json({
      success: false,
      error: "Need at least 2 submissions to evaluate consensus",
      submissions_received: submittedSlots.length,
    }, { status: 400 });
  }

  // Gather submissions
  const submissions: Submission[] = [];
  for (const slot of submittedSlots) {
    if (slot.submission_id) {
      const sub = await db.getTaskSubmission(slot.submission_id);
      const workerId = slot.worker_agent_id || slot.worker_human_id;
      if (sub && workerId) {
        submissions.push({
          id: sub.id,
          slot_number: slot.slot_number,
          worker_id: workerId,
          worker_type: slot.worker_type as "agent" | "human",
          content: sub.content,
          attachment_url: sub.attachment_url,
        });
      }
    }
  }

  // Update status to evaluating
  await db.updateMarketListing(id, { consensus_status: "evaluating" });

  // Evaluate consensus
  const method = (listing as any).consensus_method || "exact";
  const consensusResult = await evaluateConsensus(submissions, method as "exact" | "semantic");

  // Calculate payouts
  const totalBounty = parseFloat(listing.price) || 0;
  const payouts = calculatePayouts(totalBounty, slots.length, consensusResult);

  // Update slots with results
  for (const slot of slots) {
    const workerId = slot.worker_agent_id || slot.worker_human_id;
    if (workerId) {
      const isAgreeing = consensusResult.agreeingWorkers.includes(workerId);
      const payout = payouts.get(workerId) || 0;

      await db.updateConsensusSlot(slot.id, {
        status: slot.status === "submitted" ? (isAgreeing ? "agreed" : "outlier") : slot.status,
        payout_amount: payout,
      });
    }
  }

  // Update listing with consensus result
  const finalStatus = consensusResult.achieved ? "achieved" : "failed";
  await db.updateMarketListing(id, {
    consensus_status: finalStatus,
    consensus_result: JSON.stringify(consensusResult),
    status: consensusResult.achieved ? "completed" : "failed",
  });

  // Notify poster via webhook
  if (result.agent.webhook_url) {
    await dispatchWebhook(result.agent, "market.consensus_result", {
      listing_id: id,
      listing_title: listing.title,
      achieved: consensusResult.achieved,
      agreement_ratio: consensusResult.agreementRatio,
      final_answer: consensusResult.finalAnswer,
      agreeing_workers: consensusResult.agreeingWorkers.length,
      outlier_workers: consensusResult.outlierWorkers.length,
    });
  }

  // Build payout summary
  const payoutSummary: { worker_id: string; worker_type: string | null; amount: number; status: string }[] = [];
  for (const slot of slots) {
    const workerId = slot.worker_agent_id || slot.worker_human_id;
    if (workerId) {
      payoutSummary.push({
        worker_id: workerId,
        worker_type: slot.worker_type || null,
        amount: payouts.get(workerId) || 0,
        status: consensusResult.agreeingWorkers.includes(workerId) ? "agreed" : "outlier",
      });
    }
  }

  return NextResponse.json({
    success: true,
    message: consensusResult.achieved
      ? `Consensus achieved with ${(consensusResult.agreementRatio * 100).toFixed(0)}% agreement`
      : `Consensus failed - only ${(consensusResult.agreementRatio * 100).toFixed(0)}% agreement`,
    consensus_result: {
      achieved: consensusResult.achieved,
      agreement_ratio: consensusResult.agreementRatio,
      final_answer: consensusResult.finalAnswer,
      agreeing_count: consensusResult.agreeingWorkers.length,
      outlier_count: consensusResult.outlierWorkers.length,
    },
    payouts: payoutSummary,
    comparisons: consensusResult.comparisons,
  });
}
