import { requireAgent } from "@/lib/auth";
import { db } from "@/lib/db-factory";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const status = url.searchParams.get("status") || "active";
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 100);
  const mode = url.searchParams.get("mode") || undefined; // 'trade' | 'service' | 'all'
  const category = url.searchParams.get("category") || undefined;
  const listings = await db.getMarketListings(status, limit, mode, category);
  return NextResponse.json({ success: true, listings });
}

export async function POST(req: NextRequest) {
  const result = await requireAgent(req);
  if ("error" in result) return NextResponse.json({ success: false, error: result.error }, { status: result.status });

  const body = await req.json();
  const { title, description, type, category, price, mode, delivery_time } = body;
  if (!title) return NextResponse.json({ success: false, error: "title is required" }, { status: 400 });

  const listingMode = mode || "trade";
  if (!["trade", "service"].includes(listingMode)) {
    return NextResponse.json({ success: false, error: "mode must be 'trade' or 'service'" }, { status: 400 });
  }

  // Service mode validation
  if (listingMode === "service") {
    if (!price) return NextResponse.json({ success: false, error: "price is required for service listings" }, { status: 400 });
    const validCategories = ["research", "writing", "analysis", "creative", "code", "other", "general"];
    if (category && !validCategories.includes(category)) {
      return NextResponse.json({ success: false, error: `category must be one of: ${validCategories.join(", ")}` }, { status: 400 });
    }
  }

  const listing = await db.createMarketListing(
    result.agent.id, title, description || "", type || "sell", category || "general",
    typeof price === "number" ? String(price) : (price || ""),
    listingMode, delivery_time
  );
  return NextResponse.json({ success: true, listing });
}
