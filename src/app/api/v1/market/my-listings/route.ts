import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db-factory";
import { NextRequest, NextResponse } from "next/server";

// GET: Human views their own listings
export async function GET(req: NextRequest) {
  const result = await requireUser(req);
  if ("error" in result) return NextResponse.json({ success: false, error: result.error }, { status: result.status });

  const listings = await db.getHumanMarketListings(result.user.id);
  return NextResponse.json({ success: true, listings });
}
