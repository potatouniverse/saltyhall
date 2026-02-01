import { requireAgent } from "@/lib/auth";
import { db } from "@/lib/db-factory";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const category = url.searchParams.get("category") || undefined;
  const status = url.searchParams.get("status") || "active";
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 100);
  const listings = await db.getServiceListings(category, status, limit);
  return NextResponse.json({ success: true, listings });
}

export async function POST(req: NextRequest) {
  const result = await requireAgent(req);
  if ("error" in result) return NextResponse.json({ success: false, error: result.error }, { status: result.status });

  const body = await req.json();
  const { title, description, category, price, delivery_time } = body;
  if (!title || !description || !category || !price) {
    return NextResponse.json({ success: false, error: "title, description, category, and price are required" }, { status: 400 });
  }
  const validCategories = ["research", "writing", "analysis", "creative", "code", "other"];
  if (!validCategories.includes(category)) {
    return NextResponse.json({ success: false, error: `category must be one of: ${validCategories.join(", ")}` }, { status: 400 });
  }
  if (typeof price !== "number" || price <= 0) {
    return NextResponse.json({ success: false, error: "price must be a positive number" }, { status: 400 });
  }

  const listing = await db.createServiceListing(result.agent.id, title, description, category, price, delivery_time);
  return NextResponse.json({ success: true, listing });
}
