import { requireAgent, requireUser } from "@/lib/auth";
import { db } from "@/lib/db-factory";
import { eventBus } from "@/lib/events";
import { dispatchWebhook } from "@/lib/webhook";
import { verifyTaskSubmission } from "@/lib/task-verification";
import { evaluateConsensus, calculatePayouts, type Submission } from "@/lib/consensus";
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
  const workerId = isAgent && agentResult && !("error" in agentResult)
    ? agentResult.agent.id
    : humanResult && !("error" in humanResult)
    ? humanResult.user.id
    : null;
  const workerType = isAgent ? "agent" : "human";

  const { id } = await params;
  const listing = await db.getMarketListing(id);
  if (!listing) return NextResponse.json({ success: false, error: "Listing not found" }, { status: 404 });

  const body = await req.json();
  const { content, attachment_url } = body;
  if (!content || typeof content !== "string" || content.trim().length === 0) {
    return NextResponse.json({ success: false, error: "content is required" }, { status: 400 });
  }

  // Check if this is a consensus task
  const consensusCount = (listing as any).consensus_count || 1;
  const isConsensusTask = consensusCount > 1;

  if (isConsensusTask) {
    // Consensus task: check slot
    const slot = await db.getWorkerConsensusSlot(id, workerType, workerId!);
    if (!slot) {
      return NextResponse.json({ success: false, error: "You have not claimed a slot for this task" }, { status: 403 });
    }
    if (slot.status === "submitted") {
      return NextResponse.json({ success: false, error: "You have already submitted for this task" }, { status: 400 });
    }
    if (slot.status !== "claimed") {
      return NextResponse.json({ success: false, error: "Invalid slot status" }, { status: 400 });
    }

    // Create submission
    const submission = await db.createTaskSubmission(
      id,
      isAgent && agentResult && !("error" in agentResult) ? agentResult.agent.id : null as any,
      content.trim(),
      attachment_url || null
    );

    // If human submission, update with human fields
    if (isHuman && humanResult && !("error" in humanResult)) {
      await db.updateTaskSubmission(submission.id, {
        submitter_type: "human",
        submitter_human_id: humanResult.user.id,
      });
    }

    // Update slot with submission
    await db.updateConsensusSlot(slot.id, {
      submission_id: submission.id,
      status: "submitted",
    });

    // Check if all slots have submitted
    const allSlots = await db.getConsensusSlots(id);
    const submittedSlots = allSlots.filter((s: any) => s.status === "submitted");
    const allSubmitted = submittedSlots.length === consensusCount;

    if (allSubmitted) {
      // Auto-trigger consensus evaluation
      await triggerConsensusEvaluation(id, listing, allSlots);
    }

    // Notify poster
    if (listing.poster_type === "agent") {
      const agent = await db.getAgentById(listing.agent_id);
      if (agent && agent.webhook_url) {
        await dispatchWebhook(agent, "market.consensus_submission", {
          listing_id: id,
          listing_title: listing.title,
          slot_number: slot.slot_number,
          submissions_received: submittedSlots.length,
          total_slots: consensusCount,
          all_submitted: allSubmitted,
        });
      }
    }

    return NextResponse.json({
      success: true,
      submission,
      slot: { ...slot, status: "submitted", submission_id: submission.id },
      submissions_received: submittedSlots.length,
      total_slots: consensusCount,
      all_submitted: allSubmitted,
      message: allSubmitted
        ? "All submissions received. Consensus evaluation started."
        : `Submission ${submittedSlots.length}/${consensusCount} received. Waiting for other workers.`,
    });
  }

  // Regular (non-consensus) task
  // Check if this user claimed the task
  if (isAgent && agentResult && !("error" in agentResult)) {
    if ((listing as any).claimed_by !== agentResult.agent.id) {
      return NextResponse.json({ success: false, error: "You have not claimed this task" }, { status: 403 });
    }
  } else if (isHuman && humanResult && !("error" in humanResult)) {
    if ((listing as any).claimer_human_id !== humanResult.user.id) {
      return NextResponse.json({ success: false, error: "You have not claimed this task" }, { status: 403 });
    }
  }

  if (listing.status !== "in_progress") {
    return NextResponse.json({ success: false, error: "Task is not in progress" }, { status: 400 });
  }

  // Create submission (agent_id required by interface, pass null for humans and update after)
  const submission = await db.createTaskSubmission(
    id,
    isAgent && agentResult && !("error" in agentResult) ? agentResult.agent.id : null as any,
    content.trim(),
    attachment_url || null
  );

  // If human submission, update with human fields
  if (isHuman && humanResult && !("error" in humanResult)) {
    await db.updateTaskSubmission(submission.id, {
      submitter_type: "human",
      submitter_human_id: humanResult.user.id,
    });
  }

  // Update listing status to show it has a submission
  await db.updateMarketListing(id, { status: "submitted" });

  // Trigger AI verification async (don't block response)
  triggerAIVerification(submission.id, listing, { content: content.trim(), attachment_url: attachment_url || null });

  // Notify the poster
  if (listing.poster_human_id) {
    // Human poster
    eventBus.emit(`user:${listing.poster_human_id}`, {
      type: "task_submission",
      listing_id: id,
      listing_title: listing.title,
      submission_id: submission.id,
      submitter_name: isAgent && agentResult && !("error" in agentResult) ? agentResult.agent.name : "Human",
    });
  } else if (listing.poster_type === "agent") {
    // Agent poster, notify via webhook
    const agent = await db.getAgentById(listing.agent_id);
    if (agent && agent.webhook_url) {
      await dispatchWebhook(agent, "market.task_submission", {
        listing_id: id,
        listing_title: listing.title,
        submission_id: submission.id,
        submitter_type: isAgent ? "agent" : "human",
        submitter_name: isAgent && agentResult && !("error" in agentResult) ? agentResult.agent.name : (humanResult && !("error" in humanResult) ? humanResult.user.display_name || "Human" : "Unknown"),
      });
    }
  }

  return NextResponse.json({
    success: true,
    submission,
    message: "Work submitted successfully. Running AI verification and awaiting review from the task poster.",
  });
}

/**
 * Trigger AI verification async (non-blocking).
 * Runs in background and stores results in the submission.
 */
async function triggerAIVerification(
  submissionId: string,
  listing: any,
  submission: { content: string; attachment_url: string | null }
) {
  try {
    const verification = await verifyTaskSubmission(
      {
        title: listing.title,
        description: listing.description,
        acceptance_criteria: listing.acceptance_criteria,
      },
      submission
    );

    const aiStatus = verification.passed ? "ai_approved" : "ai_flagged";
    await db.updateTaskSubmission(submissionId, {
      ai_score: verification.score,
      ai_reasoning: verification.reasoning,
      ai_status: aiStatus,
      ai_issues: JSON.stringify(verification.issues),
      updated_at: new Date().toISOString(),
    });

    console.log(`✅ AI verification complete for submission ${submissionId}: ${aiStatus} (score: ${verification.score})`);
  } catch (error) {
    console.error("AI verification failed for submission", submissionId, error);
    // Don't fail submission if AI verification fails - human can still review
  }
}

/**
 * Trigger consensus evaluation after all submissions received.
 */
async function triggerConsensusEvaluation(listingId: string, listing: any, slots: any[]) {
  try {
    // Update status to evaluating
    await db.updateMarketListing(listingId, { consensus_status: "evaluating" });

    // Gather submissions
    const submissions: Submission[] = [];
    for (const slot of slots) {
      if (slot.submission_id) {
        const sub = await db.getTaskSubmission(slot.submission_id);
        if (sub) {
          submissions.push({
            id: sub.id,
            slot_number: slot.slot_number,
            worker_id: slot.worker_agent_id || slot.worker_human_id,
            worker_type: slot.worker_type as "agent" | "human",
            content: sub.content,
            attachment_url: sub.attachment_url,
          });
        }
      }
    }

    // Evaluate consensus
    const method = (listing as any).consensus_method || "exact";
    const result = await evaluateConsensus(submissions, method as "exact" | "semantic");

    // Calculate payouts
    const totalBounty = parseFloat(listing.price) || 0;
    const payouts = calculatePayouts(totalBounty, slots.length, result);

    // Update slots with results
    for (const slot of slots) {
      const workerId = slot.worker_agent_id || slot.worker_human_id;
      const isAgreeing = result.agreeingWorkers.includes(workerId);
      const payout = payouts.get(workerId) || 0;

      await db.updateConsensusSlot(slot.id, {
        status: isAgreeing ? "agreed" : "outlier",
        payout_amount: payout,
      });
    }

    // Update listing with consensus result
    const consensusStatus = result.achieved ? "achieved" : "failed";
    await db.updateMarketListing(listingId, {
      consensus_status: consensusStatus,
      consensus_result: JSON.stringify(result),
      status: result.achieved ? "completed" : "failed",
    });

    console.log(`✅ Consensus ${consensusStatus} for listing ${listingId}: ${result.agreementRatio * 100}% agreement`);

    // Notify poster
    if (listing.poster_type === "agent") {
      const agent = await db.getAgentById(listing.agent_id);
      if (agent && agent.webhook_url) {
        await dispatchWebhook(agent, "market.consensus_result", {
          listing_id: listingId,
          listing_title: listing.title,
          achieved: result.achieved,
          agreement_ratio: result.agreementRatio,
          final_answer: result.finalAnswer,
          agreeing_workers: result.agreeingWorkers.length,
          outlier_workers: result.outlierWorkers.length,
        });
      }
    }
  } catch (error) {
    console.error("Consensus evaluation failed for listing", listingId, error);
    await db.updateMarketListing(listingId, { consensus_status: "failed" });
  }
}

// GET: View submissions for a listing (users can see their own)
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const agentResult = await requireAgent(req);
  const humanResult = agentResult && "error" in agentResult ? await requireUser(req) : null;

  if (agentResult && "error" in agentResult && humanResult && "error" in humanResult) {
    return NextResponse.json({ success: false, error: "Authentication required" }, { status: 401 });
  }

  const isAgent = agentResult && !("error" in agentResult);
  const isHuman = humanResult && !("error" in humanResult);

  const { id } = await params;
  const submissions = await db.getTaskSubmissions(id);

  // Filter to own submissions
  const own = submissions.filter((s: any) => {
    if (isAgent && agentResult && !("error" in agentResult)) {
      return s.agent_id === agentResult.agent.id;
    } else if (isHuman && humanResult && !("error" in humanResult)) {
      return s.submitter_human_id === humanResult.user.id;
    }
    return false;
  });

  return NextResponse.json({ success: true, submissions: own });
}
