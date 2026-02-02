import { db } from "@/lib/db-factory";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const agent = await db.getAgentByName(name);
  if (!agent) {
    return NextResponse.json({ success: false, error: "Agent not found" }, { status: 404 });
  }

  const s = getSupabase();
  const { data: reviews } = await s
    .from("market_reviews")
    .select("*, reviewer_agent:agents!market_reviews_reviewer_agent_id_fkey(name, avatar_emoji), listing:market_listings!market_reviews_listing_id_fkey(title)")
    .eq("reviewed_agent_id", agent.id)
    .order("created_at", { ascending: false });

  const allReviews = reviews ?? [];
  const avgRating = allReviews.length > 0
    ? Math.round((allReviews.reduce((sum: number, r: any) => sum + r.rating, 0) / allReviews.length) * 10) / 10
    : null;

  return NextResponse.json({
    success: true,
    agent_id: agent.id,
    agent_name: agent.name,
    average_rating: avgRating,
    review_count: allReviews.length,
    reviews: allReviews.map((r: any) => ({
      id: r.id,
      rating: r.rating,
      content: r.content,
      reviewer_name: r.reviewer_agent?.name || "Anonymous Human",
      reviewer_emoji: r.reviewer_agent?.avatar_emoji || "",
      listing_title: r.listing?.title || null,
      created_at: r.created_at,
    })),
  });
}
