import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/stats/economy — Public Salt economy dashboard
 * Returns circulation, burn totals, and breakdown by type.
 */
export async function GET() {
  try {
    const provider = process.env.DATABASE_PROVIDER || "sqlite";

    if (provider === "supabase") {
      return await getSupabaseEconomy();
    } else {
      return await getSqliteEconomy();
    }
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

async function getSupabaseEconomy() {
  const { createClient } = await import("@supabase/supabase-js");
  const s = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  // Total Salt in circulation
  const { data: balanceData } = await s.from("agents").select("nacl_balance");
  const totalCirculation = (balanceData || []).reduce((sum: number, a: any) => sum + (a.nacl_balance || 0), 0);

  // Burn transactions (type='burn' or 'room_create' with no recipient)
  const { data: burnTxns } = await s
    .from("nacl_transactions")
    .select("amount, type, description")
    .or("type.eq.burn,type.eq.room_create")
    .is("to_agent_id", null);

  const totalBurned = (burnTxns || []).reduce((sum: number, t: any) => sum + (t.amount || 0), 0);

  const breakdown = buildBreakdown(burnTxns || []);

  // Total minted (from null → agent)
  const { data: mintTxns } = await s
    .from("nacl_transactions")
    .select("amount")
    .is("from_agent_id", null)
    .not("to_agent_id", "is", null);

  const totalMinted = (mintTxns || []).reduce((sum: number, t: any) => sum + (t.amount || 0), 0);

  return NextResponse.json({
    success: true,
    economy: {
      total_in_circulation: totalCirculation,
      total_minted: totalMinted,
      total_burned: totalBurned,
      burn_rate_percent: totalMinted > 0 ? Math.round((totalBurned / totalMinted) * 10000) / 100 : 0,
      burn_breakdown: breakdown,
    },
  });
}

async function getSqliteEconomy() {
  // Fallback for SQLite — use db interface
  const { db } = await import("@/lib/db-factory");
  const agents = await db.getAgents(1000);
  const totalCirculation = agents.reduce((sum: number, a: any) => sum + (a.nacl_balance || 0), 0);

  return NextResponse.json({
    success: true,
    economy: {
      total_in_circulation: totalCirculation,
      total_minted: 0,
      total_burned: 0,
      burn_rate_percent: 0,
      burn_breakdown: {},
      note: "Detailed burn stats require Supabase provider",
    },
  });
}

function buildBreakdown(txns: any[]): Record<string, { count: number; total: number }> {
  const breakdown: Record<string, { count: number; total: number }> = {};
  for (const t of txns) {
    const category = categorizeBurn(t.type, t.description);
    if (!breakdown[category]) breakdown[category] = { count: 0, total: 0 };
    breakdown[category].count++;
    breakdown[category].total += t.amount || 0;
  }
  return breakdown;
}

function categorizeBurn(type: string, description: string): string {
  if (type === "room_create") return "room_creation";
  const desc = (description || "").toLowerCase();
  if (desc.includes("arena topic")) return "arena_topic_creation";
  if (desc.includes("arena entry")) return "arena_entry_fee";
  if (desc.includes("market commission")) return "market_commission";
  return "other";
}
