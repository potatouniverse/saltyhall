import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db-factory";
import { eventBus } from "@/lib/events";
import { dispatchWebhook } from "@/lib/webhook";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const result = await requireUser(req);
  if ("error" in result) return NextResponse.json({ success: false, error: result.error }, { status: result.status });

  const { id } = await params;
  const submission = await db.getTaskSubmission(id);
  if (!submission) return NextResponse.json({ success: false, error: "Submission not found" }, { status: 404 });

  const listing = await db.getMarketListing(submission.listing_id);
  if (!listing) return NextResponse.json({ success: false, error: "Listing not found" }, { status: 404 });

  // Only the listing poster can review
  if (listing.poster_human_id !== result.user.id) {
    return NextResponse.json({ success: false, error: "Only the task poster can review submissions" }, { status: 403 });
  }

  const body = await req.json();
  const { action, notes } = body;
  if (!["approve", "reject", "revision_requested"].includes(action)) {
    return NextResponse.json({ success: false, error: "action must be 'approve', 'reject', or 'revision_requested'" }, { status: 400 });
  }

  const statusMap: Record<string, string> = {
    approve: "approved",
    reject: "rejected",
    revision_requested: "revision_requested",
  };

  // Update submission
  await db.updateTaskSubmission(id, {
    status: statusMap[action],
    reviewer_notes: notes || null,
    updated_at: new Date().toISOString(),
  });

  if (action === "approve") {
    // Transfer Salt from listing budget to agent
    const priceNum = parseInt(listing.price);
    if (!isNaN(priceNum) && priceNum > 0 && listing.currency !== "usdc") {
      // Transfer Salt: system → agent (budget was already deducted from human on listing creation)
      await db.transferNacl(null, submission.agent_id, priceNum, "task_reward", `🏆 Task completed: "${listing.title}" — ${priceNum} Salt`);
    }

    // Mark listing as completed
    await db.updateMarketListing(submission.listing_id, { status: "completed" });

    // Update human profile
    const profile = await db.getHumanProfile(result.user.id);
    if (profile) {
      await db.updateHumanProfile(result.user.id, {
        tasks_completed: (profile.tasks_completed || 0) + 1,
      });
    }
  } else if (action === "reject") {
    // Listing goes back to open, unclaim
    await db.updateMarketListing(submission.listing_id, {
      status: "active",
      claimed_by: null,
      claimed_at: null,
    });
  } else if (action === "revision_requested") {
    // Listing stays in_progress, agent can resubmit
    await db.updateMarketListing(submission.listing_id, { status: "in_progress" });
  }

  // Notify the agent
  const agent = await db.getAgentById(submission.agent_id);
  if (agent) {
    eventBus.emit(`agent:${submission.agent_id}`, {
      type: "submission_reviewed",
      listing_id: submission.listing_id,
      listing_title: listing.title,
      submission_id: id,
      action,
      notes: notes || undefined,
    });

    if (agent.webhook_url) {
      dispatchWebhook(agent, "market.submission_reviewed", {
        submission_id: id,
        listing_id: submission.listing_id,
        listing_title: listing.title,
        action,
        notes: notes || undefined,
        salt_awarded: action === "approve" ? parseInt(listing.price) || 0 : 0,
      });
    }
  }

  return NextResponse.json({
    success: true,
    action,
    submission_id: id,
    message: action === "approve"
      ? `Submission approved! ${listing.currency !== "usdc" ? `${listing.price} Salt transferred to agent.` : "USDC transfer pending."}`
      : action === "reject"
        ? "Submission rejected. Task is back to open."
        : "Revision requested. Agent has been notified.",
  });
}
