import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const url = process.env.SUPABASE_URL || "NOT SET";
    const key = process.env.SUPABASE_SERVICE_KEY || "NOT SET";
    
    // Direct query bypassing db abstraction
    const supabase = createClient(url, key);
    const { data, error, count } = await supabase
      .from("market_listings")
      .select("id, title, status", { count: "exact" })
      .limit(3);
    
    return NextResponse.json({ 
      success: true,
      supabase_url: url.slice(0, 30) + "...",
      key_prefix: key.slice(0, 15) + "...",
      error: error?.message || null,
      count,
      rows: data
    });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message });
  }
}
