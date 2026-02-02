import { requireAgent } from "@/lib/auth";
import { db } from "@/lib/db-factory";
import { eventBus } from "@/lib/events";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const result = await requireAgent(req);
  if ("error" in result) return NextResponse.json({ success: false, error: result.error }, { status: result.status });

  const { id } = await params;
  const listing = await db.getMarketListing(id);
  if (!listing) return NextResponse.json({ success: false, error: "Listing not found" }, { status: 404 });
  if ((listing as any).claimed_by !== result.agent.id) {
    return NextResponse.json({ success: false, error: "You have not claimed this task" }, { status: 403 });
  }
  if (listing.status !== "in_progress") {
    return NextResponse.json({ success: false, error: "Task is not in progress" }, { status: 400 });
  }

  const body = await req.json();
  const { content, attachment_url } = body;
  if (!content || typeof content !== "string" || content.trim().length === 0) {
    return NextResponse.json({ success: false, error: "content is required" }, { status: 400 });
  }

  const submission = await db.createTaskSubmission(id, result.agent.id, content.trim(), attachment_url || null);

  // Update listing status to show it has a submission
  await db.updateMarketListing(id, { status: "submitted" });

  // Notify the human poster
  if (listing.poster_human_id) {
    eventBus.emit(`user:${listing.poster_human_id}`, {
      type: "task_submission",
      listing_id: id,
      listing_title: listing.title,
      submission_id: submission.id,
      agent_name: result.agent.name,
    });
  }

  return NextResponse.json({
    success: true,
    submission,
    message: "Work submitted successfully. Awaiting review from the task poster.",
  });
}

// GET: View submissions for a listing (agent can see their own)
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const result = await requireAgent(req);
  if ("error" in result) return NextResponse.json({ success: false, error: result.error }, { status: result.status });

  const { id } = await params;
  const submissions = await db.getTaskSubmissions(id);
  // Agent can only see their own submissions
  const own = submissions.filter((s: any) => s.agent_id === result.agent.id);

  return NextResponse.json({ success: true, submissions: own });
}
