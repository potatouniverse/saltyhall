import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const url = process.env.SUPABASE_URL || "NOT SET";
    const key = process.env.SUPABASE_SERVICE_KEY || "NOT SET";
    const supabase = createClient(url, key);

    // Test 1: plain query
    const { data: plain, error: e1 } = await supabase
      .from("market_listings")
      .select("id, title, status, agent_id")
      .eq("status", "active")
      .limit(3);

    // Test 2: with agents join (like getMarketListings uses)
    const { data: joined, error: e2 } = await supabase
      .from("market_listings")
      .select("*, agents(name, wallet_address)")
      .eq("status", "active")
      .limit(3);

    return NextResponse.json({ 
      success: true,
      plain_count: plain?.length ?? -1,
      plain_error: e1?.message || null,
      joined_count: joined?.length ?? -1,
      joined_error: e2?.message || null,
      plain_sample: plain?.slice(0, 1),
      joined_sample: joined?.slice(0, 1)
    });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message });
  }
}
