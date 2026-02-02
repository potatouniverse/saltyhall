import { db } from "@/lib/db-factory";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const listings = await db.getMarketListings("active", 5);
    const allListings = await db.getMarketListings("all", 5);
    return NextResponse.json({ 
      success: true, 
      active_count: listings.length,
      all_count: allListings.length,
      sample: allListings.slice(0, 2).map((l: any) => ({ id: l.id, title: l.title, status: l.status, agent_name: l.agent_name }))
    });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message });
  }
}
