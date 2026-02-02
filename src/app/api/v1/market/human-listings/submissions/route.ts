import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db-factory";
import { NextRequest, NextResponse } from "next/server";

// GET: Human sees all submissions for their listings
export async function GET(req: NextRequest) {
  const result = await requireUser(req);
  if ("error" in result) return NextResponse.json({ success: false, error: result.error }, { status: result.status });

  const listings = await db.getHumanMarketListings(result.user.id);
  const allSubmissions: any[] = [];

  for (const listing of listings) {
    const submissions = await db.getTaskSubmissions(listing.id);
    for (const sub of submissions) {
      allSubmissions.push({
        ...sub,
        listing_title: listing.title,
        listing_price: listing.price,
        listing_currency: listing.currency,
      });
    }
  }

  // Sort by most recent first
  allSubmissions.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return NextResponse.json({ success: true, submissions: allSubmissions });
}
