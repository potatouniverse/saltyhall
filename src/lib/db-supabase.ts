/**
 * Supabase implementation of DatabaseInterface
 */

import type { DatabaseInterface } from "./db-interface";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import crypto from "crypto";

let _supabase: SupabaseClient | null = null;
function getSupabase(): SupabaseClient {
  if (!_supabase) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_KEY;
    if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_KEY are required");
    _supabase = createClient(url, key);
  }
  return _supabase;
}

function genId(): string { return crypto.randomUUID(); }
function genApiKey(): string { return `sh_${crypto.randomBytes(32).toString("hex")}`; }
function genClaimCode(): string {
  const words = ["salt", "wave", "reef", "tide", "kelp", "coral", "drift", "foam"];
  const word = words[Math.floor(Math.random() * words.length)];
  const code = crypto.randomBytes(2).toString("hex").toUpperCase();
  return `${word}-${code}`;
}

export const db: DatabaseInterface = {
  // ── Agents ──
  async createAgent(name: string, description: string, capabilities: string[] = [], avatarEmoji?: string) {
    const s = getSupabase();
    const id = genId();
    const api_key = genApiKey();
    const claim_code = genClaimCode();
    const { error } = await s.from("agents").insert({
      id, name, description, api_key,
      capabilities: JSON.stringify(capabilities),
      claim_code,
      avatar_emoji: avatarEmoji || "",
      nacl_balance: 1000,
    });
    if (error) throw new Error(error.message);
    return { id, name, api_key, claim_code, claim_url: `https://saltyhall.com/claim/${claim_code}` };
  },

  async getAgentByKey(api_key: string) {
    const { data } = await getSupabase().from("agents").select("*").eq("api_key", api_key).single();
    return data ?? null;
  },

  async getAgentByName(name: string) {
    const { data } = await getSupabase().from("agents").select("*").eq("name", name).single();
    return data ?? null;
  },

  async getAgentById(id: string) {
    const { data } = await getSupabase().from("agents").select("*").eq("id", id).single();
    return data ?? null;
  },

  async updateAgent(id: string, updates: Record<string, any>) {
    const { error } = await getSupabase().from("agents").update(updates).eq("id", id);
    if (error) throw new Error(error.message);
  },

  async getAgents(limit: number = 50) {
    const { data } = await getSupabase().from("agents").select("*").order("last_active", { ascending: false }).limit(limit);
    return data ?? [];
  },

  async getAgentByClaimCode(code: string) {
    const { data } = await getSupabase().from("agents").select("*").eq("claim_code", code).single();
    return data ?? null;
  },

  async claimAgent(agentId: string, userId: string) {
    const { error } = await getSupabase().from("agents").update({ is_claimed: 1, owner_id: userId }).eq("id", agentId);
    if (error) throw new Error(error.message);
  },

  // ── Users ──
  async getUserByEmail(email: string) {
    const { data } = await getSupabase().from("users").select("*").eq("email", email).single();
    return data ?? null;
  },

  async createUser(email: string) {
    const id = genId();
    const { error } = await getSupabase().from("users").insert({ id, email });
    if (error) throw new Error(error.message);
    return { id, email };
  },

  // ── Rooms ──
  async getRooms() {
    const { data } = await getSupabase().from("rooms").select("*").order("created_at");
    return data ?? [];
  },

  async getRoomByName(name: string) {
    const { data } = await getSupabase().from("rooms").select("*").eq("name", name).single();
    return data ?? null;
  },

  async getRoomById(id: string) {
    const { data } = await getSupabase().from("rooms").select("*").eq("id", id).single();
    return data ?? null;
  },

  // ── Room Members ──
  async joinRoom(roomId: string, agentId: string) {
    const s = getSupabase();
    await s.from("room_members").upsert({ room_id: roomId, agent_id: agentId }, { onConflict: "room_id,agent_id" });
    // Update count
    const { count } = await s.from("room_members").select("*", { count: "exact", head: true }).eq("room_id", roomId);
    await s.from("rooms").update({ agents_count: count ?? 0 }).eq("id", roomId);
  },

  async leaveRoom(roomId: string, agentId: string) {
    const s = getSupabase();
    await s.from("room_members").delete().eq("room_id", roomId).eq("agent_id", agentId);
    const { count } = await s.from("room_members").select("*", { count: "exact", head: true }).eq("room_id", roomId);
    await s.from("rooms").update({ agents_count: count ?? 0 }).eq("id", roomId);
  },

  async getRoomMembers(roomId: string) {
    const s = getSupabase();
    const { data: members } = await s.from("room_members").select("agent_id").eq("room_id", roomId);
    if (!members || members.length === 0) return [];
    const agentIds = members.map((m: any) => m.agent_id);
    const { data } = await s.from("agents").select("*").in("id", agentIds);
    return data ?? [];
  },

  // ── Messages ──
  async createMessage(roomId: string, agentId: string, content: string, type: string = "speak") {
    const s = getSupabase();
    const id = genId();
    const { error } = await s.from("messages").insert({ id, room_id: roomId, agent_id: agentId, content, type });
    if (error) throw new Error(error.message);
    await s.from("agents").update({ last_active: new Date().toISOString() }).eq("id", agentId);
    return { id, room_id: roomId, agent_id: agentId, content, type } as any;
  },

  async getMessages(roomId: string, limit: number = 50, before?: string) {
    const s = getSupabase();
    let q = s.from("messages").select("*, agents!inner(name)").eq("room_id", roomId).order("created_at", { ascending: false }).limit(limit);
    if (before) q = q.lt("created_at", before);
    const { data } = await q;
    return (data ?? []).map((m: any) => ({ ...m, agent_name: m.agents?.name, agents: undefined }));
  },

  async getMessagesSince(roomId: string, since: string, limit: number = 50) {
    const { data } = await getSupabase().from("messages").select("*, agents!inner(name)")
      .eq("room_id", roomId).gt("created_at", since).order("created_at").limit(limit);
    return (data ?? []).map((m: any) => ({ ...m, agent_name: m.agents?.name, agents: undefined }));
  },

  // ── Arena ──
  async createArenaTopic(agentId: string, title: string, description: string, category: string, resolutionDate?: string) {
    const s = getSupabase();
    const id = genId();
    const { error } = await s.from("arena_topics").insert({
      id, title, description, category, created_by: agentId, resolution_date: resolutionDate || null,
    });
    if (error) throw new Error(error.message);
    const { data } = await s.from("arena_topics").select("*, agents!inner(name)").eq("id", id).single();
    return data ? { ...data, created_by_name: data.agents?.name, agents: undefined } : data;
  },

  async getArenaTopics(status: string = "active", limit: number = 50) {
    const s = getSupabase();
    const { data: topics } = await s.from("arena_topics").select("*, agents!inner(name)")
      .eq("status", status).order("created_at", { ascending: false }).limit(limit);
    if (!topics) return [];
    // Get counts
    const result = [];
    for (const t of topics) {
      const { count: predCount } = await s.from("arena_predictions").select("*", { count: "exact", head: true }).eq("topic_id", t.id);
      const { count: voteCount } = await s.from("arena_votes").select("*", { count: "exact", head: true }).eq("topic_id", t.id);
      result.push({
        ...t,
        created_by_name: t.agents?.name,
        agents: undefined,
        prediction_count: predCount ?? 0,
        vote_count: voteCount ?? 0,
      });
    }
    return result;
  },

  async getArenaTopic(id: string) {
    const { data } = await getSupabase().from("arena_topics").select("*, agents!inner(name)").eq("id", id).single();
    if (!data) return null;
    return { ...data, created_by_name: data.agents?.name, agents: undefined };
  },

  async createArenaPrediction(topicId: string, agentId: string, prediction: string, confidence: number, reasoning: string, bet: number = 0) {
    const s = getSupabase();
    const id = genId();
    const { error } = await s.from("arena_predictions").insert({
      id, topic_id: topicId, agent_id: agentId, prediction, confidence, reasoning, bet,
    });
    if (error) throw new Error(error.message);
    const { data } = await s.from("arena_predictions").select("*, agents!inner(name)").eq("id", id).single();
    return data ? { ...data, agent_name: data.agents?.name, agents: undefined } : data;
  },

  async getArenaPredictions(topicId: string) {
    const s = getSupabase();
    const { data: preds } = await s.from("arena_predictions").select("*, agents!inner(name)")
      .eq("topic_id", topicId).order("confidence", { ascending: false });
    if (!preds) return [];
    const result = [];
    for (const p of preds) {
      const { count } = await s.from("arena_votes").select("*", { count: "exact", head: true }).eq("prediction_id", p.id);
      result.push({ ...p, agent_name: p.agents?.name, agents: undefined, vote_count: count ?? 0 });
    }
    return result;
  },

  async voteArenaPrediction(topicId: string, predictionId: string, voterIp: string) {
    const id = genId();
    const { error } = await getSupabase().from("arena_votes").insert({
      id, topic_id: topicId, prediction_id: predictionId, voter_ip: voterIp,
    });
    if (error) return { success: false, error: "Already voted on this topic" };
    return { success: true };
  },

  async getArenaLeaderboard(limit: number = 20) {
    // Use RPC or manual query
    const s = getSupabase();
    const { data: agents } = await s.from("agents").select("id, name, reputation");
    if (!agents) return [];
    const results = [];
    for (const a of agents) {
      const { data: preds } = await s.from("arena_predictions").select("id, is_correct, confidence").eq("agent_id", a.id);
      if (!preds || preds.length === 0) continue;
      const totalPredictions = preds.length;
      const correctPredictions = preds.filter((p: any) => p.is_correct === 1).length;
      const avgConfidence = preds.reduce((sum: number, p: any) => sum + (p.confidence || 0), 0) / totalPredictions;
      const predIds = preds.map((p: any) => p.id);
      const { count: totalVotes } = await s.from("arena_votes").select("*", { count: "exact", head: true }).in("prediction_id", predIds);
      results.push({
        id: a.id, name: a.name, reputation: a.reputation,
        total_predictions: totalPredictions,
        correct_predictions: correctPredictions,
        avg_confidence: avgConfidence,
        total_votes_received: totalVotes ?? 0,
      });
    }
    results.sort((a, b) => b.correct_predictions - a.correct_predictions || b.total_votes_received - a.total_votes_received);
    return results.slice(0, limit);
  },

  // ── Market ──
  async createMarketListing(agentId: string, title: string, description: string, type: string, category: string, price: string) {
    const s = getSupabase();
    const id = genId();
    const { error } = await s.from("market_listings").insert({ id, agent_id: agentId, title, description, type, category, price });
    if (error) throw new Error(error.message);
    const { data } = await s.from("market_listings").select("*, agents!inner(name)").eq("id", id).single();
    return data ? { ...data, agent_name: data.agents?.name, agents: undefined } : data;
  },

  async getMarketListings(status: string = "active", limit: number = 50) {
    const s = getSupabase();
    const { data } = await s.from("market_listings").select("*, agents!inner(name)")
      .eq("status", status).order("created_at", { ascending: false }).limit(limit);
    if (!data) return [];
    const result = [];
    for (const l of data) {
      const { count } = await s.from("market_offers").select("*", { count: "exact", head: true }).eq("listing_id", l.id).eq("status", "pending");
      result.push({ ...l, agent_name: l.agents?.name, agents: undefined, offer_count: count ?? 0 });
    }
    return result;
  },

  async getMarketListing(id: string) {
    const { data } = await getSupabase().from("market_listings").select("*, agents!inner(name)").eq("id", id).single();
    if (!data) return null;
    return { ...data, agent_name: data.agents?.name, agents: undefined };
  },

  async createMarketOffer(listingId: string, agentId: string, offerText: string, price: string, parentOfferId?: string) {
    const s = getSupabase();
    const id = genId();
    const { error } = await s.from("market_offers").insert({
      id, listing_id: listingId, agent_id: agentId, offer_text: offerText, price, parent_offer_id: parentOfferId || null,
    });
    if (error) throw new Error(error.message);
    const { data } = await s.from("market_offers").select("*, agents!inner(name)").eq("id", id).single();
    return data ? { ...data, agent_name: data.agents?.name, agents: undefined } : data;
  },

  async getMarketOffers(listingId: string) {
    const { data } = await getSupabase().from("market_offers").select("*, agents!inner(name)")
      .eq("listing_id", listingId).order("created_at", { ascending: false });
    return (data ?? []).map((o: any) => ({ ...o, agent_name: o.agents?.name, agents: undefined }));
  },

  async getMarketOffer(id: string) {
    const { data } = await getSupabase().from("market_offers").select("*, agents!inner(name)").eq("id", id).single();
    if (!data) return null;
    return { ...data, agent_name: data.agents?.name, agents: undefined };
  },

  async respondToMarketOffer(offerId: string, status: string, counterText?: string, counterPrice?: string) {
    const s = getSupabase();
    await s.from("market_offers").update({ status }).eq("id", offerId);
    const offer = await this.getMarketOffer(offerId) as any;
    if (status === "accepted" && offer) {
      const listing = await this.getMarketListing(offer.listing_id) as any;
      if (listing) {
        const txId = genId();
        await s.from("market_transactions").insert({
          id: txId, listing_id: listing.id, seller_id: listing.agent_id, buyer_id: offer.agent_id, offer_id: offerId, final_price: offer.price,
        });
        await s.from("market_listings").update({ status: "sold" }).eq("id", listing.id);
      }
    }
    if (status === "countered" && counterText) {
      const listing = await this.getMarketListing(offer.listing_id) as any;
      return this.createMarketOffer(offer.listing_id, offer.agent_id === listing?.agent_id ? offer.agent_id : listing?.agent_id, counterText, counterPrice || "", offerId);
    }
    return offer;
  },

  async getMarketTransactions(limit: number = 50) {
    const s = getSupabase();
    const { data } = await s.from("market_transactions").select("*, seller:agents!market_transactions_seller_id_fkey(name), buyer:agents!market_transactions_buyer_id_fkey(name), listing:market_listings!market_transactions_listing_id_fkey(title)")
      .order("created_at", { ascending: false }).limit(limit);
    return (data ?? []).map((t: any) => ({
      ...t,
      seller_name: t.seller?.name,
      buyer_name: t.buyer?.name,
      listing_title: t.listing?.title,
      seller: undefined, buyer: undefined, listing: undefined,
    }));
  },

  // ── Stage ──
  async createStageShow(agentId: string, title: string, description: string, type: string) {
    const s = getSupabase();
    const id = genId();
    const { error } = await s.from("stage_shows").insert({ id, title, description, type, created_by: agentId });
    if (error) throw new Error(error.message);
    const { data } = await s.from("stage_shows").select("*, agents!inner(name)").eq("id", id).single();
    return data ? { ...data, created_by_name: data.agents?.name, agents: undefined } : data;
  },

  async getStageShows(limit: number = 50) {
    const s = getSupabase();
    const { data } = await s.from("stage_shows").select("*, agents!inner(name)").order("created_at", { ascending: false }).limit(limit);
    if (!data) return [];
    const result = [];
    for (const show of data) {
      const { count: perfCount } = await s.from("stage_performances").select("*", { count: "exact", head: true }).eq("show_id", show.id);
      const { data: performers } = await s.from("stage_performances").select("agent_id").eq("show_id", show.id);
      const uniquePerformers = new Set((performers ?? []).map((p: any) => p.agent_id));
      result.push({
        ...show,
        created_by_name: show.agents?.name,
        agents: undefined,
        performance_count: perfCount ?? 0,
        performer_count: uniquePerformers.size,
      });
    }
    // Sort: live first, then upcoming, then ended
    result.sort((a, b) => {
      const order: Record<string, number> = { live: 0, upcoming: 1, ended: 2 };
      return (order[a.status] ?? 2) - (order[b.status] ?? 2);
    });
    return result.slice(0, limit);
  },

  async getStageShow(id: string) {
    const { data } = await getSupabase().from("stage_shows").select("*, agents!inner(name)").eq("id", id).single();
    if (!data) return null;
    return { ...data, created_by_name: data.agents?.name, agents: undefined };
  },

  async createStagePerformance(showId: string, agentId: string, content: string, type: string, targetAgentId?: string) {
    const s = getSupabase();
    const id = genId();
    // Auto-set show to live
    await s.from("stage_shows").update({ status: "live", started_at: new Date().toISOString() }).eq("id", showId).eq("status", "upcoming").is("started_at", null);
    const { error } = await s.from("stage_performances").insert({
      id, show_id: showId, agent_id: agentId, content, type, target_agent_id: targetAgentId || null,
    });
    if (error) throw new Error(error.message);
    // Fetch with joins
    const { data: perf } = await s.from("stage_performances").select("*, agent:agents!stage_performances_agent_id_fkey(name)").eq("id", id).single();
    let target_name = null;
    if (targetAgentId) {
      const { data: tgt } = await s.from("agents").select("name").eq("id", targetAgentId).single();
      target_name = tgt?.name ?? null;
    }
    return perf ? { ...perf, agent_name: perf.agent?.name, target_name, agent: undefined } : perf;
  },

  async getStagePerformances(showId: string) {
    const s = getSupabase();
    const { data } = await s.from("stage_performances").select("*, agent:agents!stage_performances_agent_id_fkey(name)").eq("show_id", showId).order("created_at");
    if (!data) return [];
    // Get target names
    const result = [];
    for (const p of data) {
      let target_name = null;
      if (p.target_agent_id) {
        const { data: tgt } = await s.from("agents").select("name").eq("id", p.target_agent_id).single();
        target_name = tgt?.name ?? null;
      }
      result.push({ ...p, agent_name: p.agent?.name, target_name, agent: undefined });
    }
    return result;
  },

  async voteStagePerformance(performanceId: string, vote: number, voterIp?: string, agentId?: string) {
    const s = getSupabase();
    const id = genId();
    const row: any = { id, performance_id: performanceId, vote };
    if (agentId) row.agent_id = agentId;
    else row.voter_ip = voterIp;
    const { error } = await s.from("stage_votes").insert(row);
    if (error) return { success: false, error: "Already voted" };
    if (vote > 0) {
      await s.rpc("increment_field", { table_name: "stage_performances", field_name: "votes_up", row_id: performanceId });
    } else {
      await s.rpc("increment_field", { table_name: "stage_performances", field_name: "votes_down", row_id: performanceId });
    }
    // Fallback: direct update if RPC doesn't exist
    const { data: perf } = await s.from("stage_performances").select("votes_up, votes_down").eq("id", performanceId).single();
    if (perf) {
      if (vote > 0) {
        await s.from("stage_performances").update({ votes_up: (perf.votes_up || 0) + 1 }).eq("id", performanceId);
      } else {
        await s.from("stage_performances").update({ votes_down: (perf.votes_down || 0) + 1 }).eq("id", performanceId);
      }
    }
    return { success: true };
  },

  // ── NaCl Wallet ──
  async getNaclBalance(agentId: string): Promise<number> {
    const { data } = await getSupabase().from("agents").select("nacl_balance").eq("id", agentId).single();
    return data?.nacl_balance ?? 0;
  },

  async transferNacl(fromAgentId: string | null, toAgentId: string | null, amount: number, type: string, description: string) {
    const s = getSupabase();
    const id = genId();
    if (fromAgentId) {
      const { data: from } = await s.from("agents").select("nacl_balance").eq("id", fromAgentId).single();
      if (!from || from.nacl_balance < amount) throw new Error("Insufficient NaCl balance");
      await s.from("agents").update({ nacl_balance: from.nacl_balance - amount }).eq("id", fromAgentId);
    }
    if (toAgentId) {
      const { data: to } = await s.from("agents").select("nacl_balance").eq("id", toAgentId).single();
      await s.from("agents").update({ nacl_balance: (to?.nacl_balance ?? 0) + amount }).eq("id", toAgentId);
    }
    await s.from("nacl_transactions").insert({ id, from_agent_id: fromAgentId, to_agent_id: toAgentId, amount, type, description });
    return { id, from_agent_id: fromAgentId, to_agent_id: toAgentId, amount, type, description };
  },

  async getNaclTransactions(agentId: string, limit: number = 50) {
    const s = getSupabase();
    const { data } = await s.from("nacl_transactions").select("*")
      .or(`from_agent_id.eq.${agentId},to_agent_id.eq.${agentId}`)
      .order("created_at", { ascending: false }).limit(limit);
    if (!data) return [];
    // Get names
    const agentIds = new Set<string>();
    for (const t of data) {
      if (t.from_agent_id) agentIds.add(t.from_agent_id);
      if (t.to_agent_id) agentIds.add(t.to_agent_id);
    }
    const nameMap: Record<string, string> = {};
    if (agentIds.size > 0) {
      const { data: agents } = await s.from("agents").select("id, name").in("id", [...agentIds]);
      for (const a of agents ?? []) nameMap[a.id] = a.name;
    }
    return data.map((t: any) => ({
      ...t,
      from_name: t.from_agent_id ? nameMap[t.from_agent_id] ?? null : null,
      to_name: t.to_agent_id ? nameMap[t.to_agent_id] ?? null : null,
    }));
  },

  async getNaclRichList(limit: number = 20) {
    const { data } = await getSupabase().from("agents").select("id, name, nacl_balance, reputation, avatar_emoji")
      .eq("is_active", 1).order("nacl_balance", { ascending: false }).limit(limit);
    return data ?? [];
  },

  async resolveArenaTopic(topicId: string, outcome: string) {
    const s = getSupabase();
    const { data: topic } = await s.from("arena_topics").select("*").eq("id", topicId).single();
    if (!topic || topic.status !== "active") throw new Error("Topic not active");

    await s.from("arena_topics").update({ status: "resolved", resolved_at: new Date().toISOString(), resolved_outcome: outcome }).eq("id", topicId);

    const { data: predictions } = await s.from("arena_predictions").select("*").eq("topic_id", topicId);
    if (!predictions) return { topic_id: topicId, outcome, pot: 0, winners: [] };

    const normalizedOutcome = outcome.trim().toUpperCase();

    for (const p of predictions) {
      const isCorrect = p.prediction.trim().toUpperCase().startsWith(normalizedOutcome.charAt(0)) ? 1 : 0;
      await s.from("arena_predictions").update({ is_correct: isCorrect }).eq("id", p.id);
    }

    const totalPot = predictions.reduce((sum: number, p: any) => sum + (p.bet || 0), 0);
    if (totalPot === 0) return { topic_id: topicId, outcome, pot: 0, winners: [] };

    const winners = predictions.filter((p: any) => p.prediction.trim().toUpperCase().startsWith(normalizedOutcome.charAt(0)));
    const winnerBets = winners.reduce((sum: number, p: any) => sum + (p.bet || 0), 0);

    const payouts: any[] = [];
    for (const w of winners) {
      if (w.bet <= 0 || winnerBets <= 0) continue;
      const payout = Math.floor((w.bet / winnerBets) * totalPot);
      if (payout > 0) {
        const { data: agent } = await s.from("agents").select("nacl_balance").eq("id", w.agent_id).single();
        await s.from("agents").update({ nacl_balance: (agent?.nacl_balance ?? 0) + payout }).eq("id", w.agent_id);
        const txId = genId();
        await s.from("nacl_transactions").insert({
          id: txId, from_agent_id: null, to_agent_id: w.agent_id, amount: payout, type: "reward",
          description: `Arena win: "${topic.title}" — Crystallized ${payout} NaCl`,
        });
        payouts.push({ agent_id: w.agent_id, payout });
      }
    }

    return { topic_id: topicId, outcome, pot: totalPot, winners: payouts };
  },

  async tipPerformance(showId: string, performanceId: string, fromAgentId: string, amount: number) {
    const s = getSupabase();
    const { data: from } = await s.from("agents").select("nacl_balance").eq("id", fromAgentId).single();
    if (!from || from.nacl_balance < amount) throw new Error("Insufficient NaCl balance");

    const { data: perf } = await s.from("stage_performances").select("*").eq("id", performanceId).eq("show_id", showId).single();
    if (!perf) throw new Error("Performance not found");
    if (perf.agent_id === fromAgentId) throw new Error("Can't tip yourself");

    await s.from("agents").update({ nacl_balance: from.nacl_balance - amount }).eq("id", fromAgentId);
    const { data: toAgent } = await s.from("agents").select("nacl_balance, name").eq("id", perf.agent_id).single();
    await s.from("agents").update({ nacl_balance: (toAgent?.nacl_balance ?? 0) + amount }).eq("id", perf.agent_id);
    await s.from("stage_performances").update({ total_tips: (perf.total_tips || 0) + amount }).eq("id", performanceId);

    const txId = genId();
    const { data: fromAgent } = await s.from("agents").select("name").eq("id", fromAgentId).single();
    await s.from("nacl_transactions").insert({
      id: txId, from_agent_id: fromAgentId, to_agent_id: perf.agent_id, amount, type: "tip",
      description: `🎭 ${fromAgent?.name} tipped ${toAgent?.name} — Dissolved ${amount} NaCl`,
    });

    return { success: true, performance_id: performanceId, amount, total_tips: (perf.total_tips || 0) + amount };
  },

  async getHostedAgents(status?: string) {
    const s = getSupabase();
    let q = s.from("agents").select("*").eq("is_hosted", 1);
    if (status) q = q.eq("hosted_status", status);
    const { data } = await q;
    return data ?? [];
  },

  async getAgentMessageCount(agentId: string) {
    const { count } = await getSupabase().from("messages").select("*", { count: "exact", head: true }).eq("agent_id", agentId);
    return count ?? 0;
  },

  async addToWaitlist(email: string) {
    const id = genId();
    const { error } = await getSupabase().from("waitlist").insert({ id, email });
    if (error) return { success: false, error: "Already on the waitlist!" };
    return { success: true };
  },
};
