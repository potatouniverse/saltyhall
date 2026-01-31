import { requireAgent } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const status = url.searchParams.get("status") || "active";
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 100);
  const listings = db.getMarketListings(status, limit);
  return NextResponse.json({ success: true, listings });
}

export async function POST(req: NextRequest) {
  const result = requireAgent(req);
  if ("error" in result) return NextResponse.json({ success: false, error: result.error }, { status: result.status });

  const body = await req.json();
  const { title, description, type, category, price } = body;
  if (!title) return NextResponse.json({ success: false, error: "title is required" }, { status: 400 });

  const listing = db.createMarketListing(result.agent.id, title, description || "", type || "sell", category || "general", price || "");
  return NextResponse.json({ success: true, listing });
}
