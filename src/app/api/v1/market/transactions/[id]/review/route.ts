import { NextRequest, NextResponse } from "next/server";
import { getAgentFromRequest, getUserFromRequest } from "@/lib/auth";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: transactionId } = await params;
  const agent = await getAgentFromRequest(req);
  const user = await getUserFromRequest(req);

  if (!agent && !user) {
    return NextResponse.json({ success: false, error: "Authentication required" }, { status: 401 });
  }

  const { rating, content } = await req.json();
  if (!rating || rating < 1 || rating > 5) {
    return NextResponse.json({ success: false, error: "Rating must be 1-5" }, { status: 400 });
  }

  const s = getSupabase();

  // Get the transaction
  const { data: tx } = await s.from("market_transactions").select("*").eq("id", transactionId).single();
  if (!tx) {
    return NextResponse.json({ success: false, error: "Transaction not found" }, { status: 404 });
  }

  // Determine reviewer identity and who they're reviewing
  const reviewerAgentId = agent?.id || null;
  const reviewerHumanId = user?.id || null;

  // Figure out which side the reviewer is on and who they're reviewing
  let reviewedAgentId: string | null = null;
  if (agent) {
    if (agent.id === tx.seller_id) {
      reviewedAgentId = tx.buyer_id;
    } else if (agent.id === tx.buyer_id) {
      reviewedAgentId = tx.seller_id;
    } else {
      return NextResponse.json({ success: false, error: "You are not a party to this transaction" }, { status: 403 });
    }
  } else {
    // Human reviewer — check if they own the listing poster
    const { data: listing } = await s.from("market_listings").select("poster_human_id, agent_id").eq("id", tx.listing_id).single();
    if (listing?.poster_human_id === user!.id) {
      // Human posted the listing, reviewing the buyer
      reviewedAgentId = tx.buyer_id;
    } else {
      return NextResponse.json({ success: false, error: "You are not a party to this transaction" }, { status: 403 });
    }
  }

  // Check for duplicate review
  const dupQuery = s.from("market_reviews").select("id").eq("listing_id", tx.listing_id);
  if (reviewerAgentId) dupQuery.eq("reviewer_agent_id", reviewerAgentId);
  else dupQuery.eq("reviewer_human_id", reviewerHumanId);
  const { data: existing } = await dupQuery;
  if (existing && existing.length > 0) {
    return NextResponse.json({ success: false, error: "You already reviewed this transaction" }, { status: 409 });
  }

  // Create review
  const { data: review, error } = await s.from("market_reviews").insert({
    listing_id: tx.listing_id,
    reviewer_agent_id: reviewerAgentId,
    reviewer_human_id: reviewerHumanId,
    reviewed_agent_id: reviewedAgentId,
    rating,
    content: content || null,
  }).select("*").single();

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, review });
}
