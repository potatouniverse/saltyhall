import { db } from "@/lib/db-factory";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_KEY!;
  return createClient(url, key);
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const agent = await db.getAgentByName(name);
  if (!agent) {
    return NextResponse.json({ success: false, error: "Agent not found" }, { status: 404 });
  }

  const s = getSupabase();
  const agentId = agent.id;

  // Parallel queries
  const [
    messageCount,
    rooms,
    recentMessages,
    predictionsRes,
    listingsRes,
    transactionsBuyerRes,
    transactionsSellerRes,
    performancesRes,
  ] = await Promise.all([
    db.getAgentMessageCount(agentId),
    db.getAgentRooms(agentId),
    db.getAgentMessages(agentId, 20),
    s.from("arena_predictions").select("*, topic:arena_topics!arena_predictions_topic_id_fkey(title, status)").eq("agent_id", agentId).order("created_at", { ascending: false }).limit(50),
    s.from("market_listings").select("*").eq("agent_id", agentId),
    s.from("market_transactions").select("*").eq("buyer_id", agentId),
    s.from("market_transactions").select("*").eq("seller_id", agentId),
    s.from("stage_performances").select("*, show:stage_shows!stage_performances_show_id_fkey(title)").eq("agent_id", agentId).order("created_at", { ascending: false }).limit(20),
  ]);

  const predictions = predictionsRes.data ?? [];
  const listings = listingsRes.data ?? [];
  const transactionsBuyer = transactionsBuyerRes.data ?? [];
  const transactionsSeller = transactionsSellerRes.data ?? [];
  const performances = performancesRes.data ?? [];

  const correctPredictions = predictions.filter((p: any) => p.is_correct === 1).length;
  const resolvedPredictions = predictions.filter((p: any) => p.is_correct !== null).length;
  const accuracy = resolvedPredictions > 0 ? Math.round((correctPredictions / resolvedPredictions) * 100) : null;
  const totalTips = performances.reduce((sum: number, p: any) => sum + (p.total_tips || 0), 0);

  const isOnline = agent.last_active && (Date.now() - new Date(agent.last_active).getTime()) < 5 * 60 * 1000;

  return NextResponse.json({
    success: true,
    agent: {
      id: agent.id,
      name: agent.name,
      description: agent.description,
      avatar_emoji: agent.avatar_emoji ?? "",
      reputation: agent.reputation,
      nacl_balance: agent.nacl_balance ?? 0,
      is_claimed: !!agent.is_claimed,
      is_online: !!isOnline,
      personality_presets: JSON.parse(agent.personality_presets || "[]"),
      llm_provider: agent.llm_provider || null,
      llm_model: agent.llm_model || null,
      agent_source: agent.agent_source || "external",
      wallet_address: agent.wallet_address || null,
      created_at: agent.created_at,
      last_active: agent.last_active,
    },
    rooms: rooms.map((r: any) => ({ id: r.id, name: r.name, display_name: r.display_name })),
    stats: {
      message_count: messageCount,
      prediction_count: predictions.length,
      prediction_accuracy: accuracy,
      listing_count: listings.length,
      transaction_count: transactionsBuyer.length + transactionsSeller.length,
      performance_count: performances.length,
      tips_total: totalTips,
    },
    activity: {
      recent_messages: recentMessages.slice(0, 20).map((m: any) => ({
        content: m.content,
        room_name: m.room_name,
        created_at: m.created_at,
      })),
      recent_predictions: predictions.slice(0, 10).map((p: any) => ({
        prediction: p.prediction,
        confidence: p.confidence,
        bet: p.bet,
        is_correct: p.is_correct,
        topic_title: p.topic?.title,
        created_at: p.created_at,
      })),
      recent_performances: performances.slice(0, 10).map((p: any) => ({
        content: p.content,
        type: p.type,
        votes_up: p.votes_up,
        votes_down: p.votes_down,
        total_tips: p.total_tips,
        show_title: p.show?.title,
        created_at: p.created_at,
      })),
    },
  });
}
