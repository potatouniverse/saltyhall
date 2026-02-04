import { requireUser, requireAgent } from "@/lib/auth";
import { db } from "@/lib/db-factory";
import { verifyTaskSubmission } from "@/lib/task-verification";
import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/v1/market/submissions/:id/verify
 * Run AI verification on a task submission.
 * Can be triggered automatically or manually by the task poster (human or agent).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Try both auth methods — poster can be human OR agent
  const agentResult = await requireAgent(req);
  const humanResult = agentResult && "error" in agentResult ? await requireUser(req) : null;

  if (agentResult && "error" in agentResult && humanResult && "error" in humanResult) {
    return NextResponse.json(
      { success: false, error: "Authentication required" },
      { status: 401 }
    );
  }

  const isAgent = agentResult && !("error" in agentResult);
  const isHuman = humanResult && !("error" in humanResult);

  const { id } = await params;
  const submission = await db.getTaskSubmission(id);
  if (!submission) {
    return NextResponse.json(
      { success: false, error: "Submission not found" },
      { status: 404 }
    );
  }

  const listing = await db.getMarketListing(submission.listing_id);
  if (!listing) {
    return NextResponse.json(
      { success: false, error: "Listing not found" },
      { status: 404 }
    );
  }

  // Only the listing poster can trigger verification
  // For human-posted tasks: human poster must match
  // For agent-posted tasks: agent poster must match
  if (isHuman && humanResult && !("error" in humanResult)) {
    if (listing.poster_human_id !== humanResult.user.id) {
      return NextResponse.json(
        { success: false, error: "Only the task poster can trigger verification" },
        { status: 403 }
      );
    }
  } else if (isAgent && agentResult && !("error" in agentResult)) {
    if (listing.poster_type !== "agent" || listing.agent_id !== agentResult.agent.id) {
      return NextResponse.json(
        { success: false, error: "Only the task poster can trigger verification" },
        { status: 403 }
      );
    }
  }

  try {
    // Run AI verification
    const verification = await verifyTaskSubmission(
      {
        title: listing.title,
        description: listing.description,
        acceptance_criteria: listing.acceptance_criteria,
      },
      {
        content: submission.content,
        attachment_url: submission.attachment_url,
      }
    );

    // Store results in submission
    const aiStatus = verification.passed ? "ai_approved" : "ai_flagged";
    await db.updateTaskSubmission(id, {
      ai_score: verification.score,
      ai_reasoning: verification.reasoning,
      ai_status: aiStatus,
      ai_issues: JSON.stringify(verification.issues),
      updated_at: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      verification: {
        score: verification.score,
        passed: verification.passed,
        reasoning: verification.reasoning,
        issues: verification.issues,
        status: aiStatus,
      },
      message: verification.passed
        ? "✅ AI verification passed - submission looks good!"
        : "⚠️ AI verification flagged issues - manual review recommended",
    });
  } catch (error) {
    console.error("Verification endpoint error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Verification failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/v1/market/submissions/:id/verify
 * Retrieve AI verification results for a submission.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Try both auth methods — poster can be human OR agent
  const agentResult = await requireAgent(req);
  const humanResult = agentResult && "error" in agentResult ? await requireUser(req) : null;

  if (agentResult && "error" in agentResult && humanResult && "error" in humanResult) {
    return NextResponse.json(
      { success: false, error: "Authentication required" },
      { status: 401 }
    );
  }

  const isAgent = agentResult && !("error" in agentResult);
  const isHuman = humanResult && !("error" in humanResult);

  const { id } = await params;
  const submission = await db.getTaskSubmission(id);
  if (!submission) {
    return NextResponse.json(
      { success: false, error: "Submission not found" },
      { status: 404 }
    );
  }

  const listing = await db.getMarketListing(submission.listing_id);
  if (!listing) {
    return NextResponse.json(
      { success: false, error: "Listing not found" },
      { status: 404 }
    );
  }

  // Only the listing poster can view verification results
  if (isHuman && humanResult && !("error" in humanResult)) {
    if (listing.poster_human_id !== humanResult.user.id) {
      return NextResponse.json(
        { success: false, error: "Only the task poster can view verification results" },
        { status: 403 }
      );
    }
  } else if (isAgent && agentResult && !("error" in agentResult)) {
    if (listing.poster_type !== "agent" || listing.agent_id !== agentResult.agent.id) {
      return NextResponse.json(
        { success: false, error: "Only the task poster can view verification results" },
        { status: 403 }
      );
    }
  }

  return NextResponse.json({
    success: true,
    verification: {
      score: submission.ai_score,
      status: submission.ai_status,
      reasoning: submission.ai_reasoning,
      issues: submission.ai_issues
        ? JSON.parse(submission.ai_issues)
        : [],
    },
  });
}
