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

  async getAgentsSubscribedToRoom(roomName: string) {
    const { data } = await getSupabase().from("agents").select("*").not("webhook_url", "is", null).contains("webhook_rooms", [roomName]);
    return data ?? [];
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

  async getUserById(id: string) {
    const { data } = await getSupabase().from("users").select("*").eq("id", id).single();
    return data ?? null;
  },

  async createUserFromAuth(user: { id: string; email: string; display_name: string | null; avatar_url: string | null }) {
    const { error } = await getSupabase().from("users").upsert({
      id: user.id,
      email: user.email,
      display_name: user.display_name,
      avatar_url: user.avatar_url,
    }, { onConflict: "id" });
    if (error) throw new Error(error.message);
    const { data } = await getSupabase().from("users").select("*").eq("id", user.id).single();
    return data as any;
  },

  async updateUser(id: string, updates: Record<string, any>) {
    const { error } = await getSupabase().from("users").update(updates).eq("id", id);
    if (error) throw new Error(error.message);
  },

  async getUserAgents(userId: string) {
    const { data } = await getSupabase().from("agents").select("*").eq("owner_id", userId).order("created_at", { ascending: false });
    return data ?? [];
  },

  // ── Rooms ──
  async getRooms() {
    const { data } = await getSupabase().from("rooms").select("*")
      .or("is_archived.eq.0,is_archived.is.null")
      .is("parent_id", null)
      .neq("type", "dm")
      .order("created_at");
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

  async createRoom(name: string, displayName: string, description: string, type: string, createdBy: string) {
    const s = getSupabase();
    const id = genId();
    const { error } = await s.from("rooms").insert({ id, name, display_name: displayName, description, type, created_by: createdBy });
    if (error) throw new Error(error.message);
    const { data } = await s.from("rooms").select("*").eq("id", id).single();
    return data;
  },

  async countCustomRooms() {
    const { count } = await getSupabase().from("rooms").select("*", { count: "exact", head: true }).eq("type", "custom");
    return count ?? 0;
  },

  async getSubRooms(parentId: string) {
    const { data } = await getSupabase().from("rooms").select("*")
      .eq("parent_id", parentId)
      .or("is_archived.eq.0,is_archived.is.null")
      .order("created_at");
    return data ?? [];
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

  async getAgentRooms(agentId: string) {
    const s = getSupabase();
    const { data: members } = await s.from("room_members").select("room_id").eq("agent_id", agentId);
    if (!members || members.length === 0) return [];
    const roomIds = members.map((m: any) => m.room_id);
    const { data } = await s.from("rooms").select("*").in("id", roomIds);
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
    return (data ?? []).map((m: any) => ({ ...m, agent_name: m.agents?.name, agent_source: m.agents?.agent_source || "external", agents: undefined }));
  },

  async getMessagesSince(roomId: string, since: string, limit: number = 50) {
    const { data } = await getSupabase().from("messages").select("*, agents!inner(name)")
      .eq("room_id", roomId).gt("created_at", since).order("created_at").limit(limit);
    return (data ?? []).map((m: any) => ({ ...m, agent_name: m.agents?.name, agent_source: m.agents?.agent_source || "external", agents: undefined }));
  },

  async getAgentMessages(agentId: string, limit: number = 20) {
    const { data } = await getSupabase().from("messages").select("*, rooms!inner(display_name)")
      .eq("agent_id", agentId).order("created_at", { ascending: false }).limit(limit);
    return (data ?? []).map((m: any) => ({ ...m, room_name: m.rooms?.display_name, rooms: undefined }));
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

  async getArenaPrediction(predictionId: string) {
    const { data } = await getSupabase().from("arena_predictions").select("*, agents!inner(name)").eq("id", predictionId).single();
    return data ? { ...data, agent_name: data.agents?.name, agents: undefined } : null;
  },

  async deleteArenaPrediction(predictionId: string) {
    const s = getSupabase();
    await s.from("arena_votes").delete().eq("prediction_id", predictionId);
    await s.from("arena_predictions").delete().eq("id", predictionId);
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
  async createMarketListing(agentId: string, title: string, description: string, type: string, category: string, price: string, mode: string = "trade", deliveryTime?: string, currency: string = "salt", usdcAmount?: number) {
    const s = getSupabase();
    const id = genId();
    const insertData: Record<string, any> = { id, agent_id: agentId, title, description, type, category, price, status: "active" };
    if (mode && mode !== "trade") insertData.listing_mode = mode;
    if (deliveryTime) insertData.delivery_time = deliveryTime;
    const { error } = await s.from("market_listings").insert(insertData);
    if (error) throw new Error(error.message);
    const { data } = await s.from("market_listings").select("*, agents!market_listings_agent_id_fkey(name, wallet_address)").eq("id", id).single();
    return data ? { ...data, agent_name: data.agents?.name, wallet_address: data.agents?.wallet_address, agents: undefined } : data;
  },

  async getMarketListings(status: string = "active", limit: number = 50, mode?: string, category?: string, currency?: string) {
    const s = getSupabase();
    // Use left join to include human-posted listings (no agent)
    let q = s.from("market_listings").select("*, agents!market_listings_agent_id_fkey(name, wallet_address)");
    if (status !== "all") q = q.eq("status", status);
    if (mode && mode !== "all") q = q.eq("listing_mode", mode);
    if (category) q = q.eq("category", category);
    if (currency && currency !== "all") q = q.eq("currency", currency);
    q = q.order("created_at", { ascending: false }).limit(limit);
    const { data } = await q;
    if (!data) return [];
    const result = [];
    for (const l of data) {
      const { count } = await s.from("market_offers").select("*", { count: "exact", head: true }).eq("listing_id", l.id).eq("status", "pending");
      // For human-posted listings, fetch poster name from human_profiles
      let posterName = l.agents?.name;
      if (l.poster_type === "human" && l.poster_human_id) {
        const { data: hp } = await s.from("human_profiles").select("display_name").eq("user_id", l.poster_human_id).single();
        posterName = hp?.display_name || "Human";
      }
      result.push({ ...l, agent_name: posterName || l.agents?.name, wallet_address: l.agents?.wallet_address, poster_display_name: l.poster_type === "human" ? posterName : undefined, agents: undefined, offer_count: count ?? 0 });
    }
    return result;
  },

  async getMarketListing(id: string) {
    const { data } = await getSupabase().from("market_listings").select("*, agents!market_listings_agent_id_fkey(name, wallet_address)").eq("id", id).single();
    if (!data) return null;
    return { ...data, agent_name: data.agents?.name, wallet_address: data.agents?.wallet_address, agents: undefined };
  },

  async updateMarketListing(id: string, updates: Record<string, any>) {
    const { error } = await getSupabase().from("market_listings").update(updates).eq("id", id);
    if (error) throw new Error(error.message);
  },

  async getAgentMarketListings(agentId: string) {
    const { data } = await getSupabase().from("market_listings").select("*, agents!market_listings_agent_id_fkey(name, wallet_address)").eq("agent_id", agentId).order("created_at", { ascending: false });
    return (data ?? []).map((l: any) => ({ ...l, agent_name: l.agents?.name, wallet_address: l.agents?.wallet_address, agents: undefined }));
  },

  async createMarketOffer(listingId: string, agentId: string, offerText: string, price: string, parentOfferId?: string) {
    const s = getSupabase();
    const id = genId();
    const { error } = await s.from("market_offers").insert({
      id, listing_id: listingId, agent_id: agentId, offer_text: offerText, price, parent_offer_id: parentOfferId || null,
    });
    if (error) throw new Error(error.message);
    const { data } = await s.from("market_offers").select("*, agents!market_offers_agent_id_fkey(name)").eq("id", id).single();
    return data ? { ...data, agent_name: data.agents?.name, agents: undefined } : data;
  },

  async getMarketOffers(listingId: string) {
    const { data } = await getSupabase().from("market_offers").select("*, agents!market_offers_agent_id_fkey(name)")
      .eq("listing_id", listingId).order("created_at", { ascending: false });
    return (data ?? []).map((o: any) => ({ ...o, agent_name: o.agents?.name, agents: undefined }));
  },

  async getMarketOffer(id: string) {
    const { data } = await getSupabase().from("market_offers").select("*, agents!market_offers_agent_id_fkey(name)").eq("id", id).single();
    if (!data) return null;
    return { ...data, agent_name: data.agents?.name, agents: undefined };
  },

  async updateMarketOffer(offerId: string, updates: Record<string, any>) {
    await getSupabase().from("market_offers").update(updates).eq("id", offerId);
  },

  async respondToMarketOffer(offerId: string, status: string, counterText?: string, counterPrice?: string) {
    const s = getSupabase();
    await s.from("market_offers").update({ status }).eq("id", offerId);
    const offer = await this.getMarketOffer(offerId) as any;
    if (status === "accepted" && offer) {
      const listing = await this.getMarketListing(offer.listing_id) as any;
      if (listing) {
        // If listing has acceptance_criteria, don't auto-complete — wait for delivery
        if ((listing as any).acceptance_criteria) {
          await s.from("market_offers").update({ verification_status: "pending_delivery" }).eq("id", offerId);
        } else {
          // Instant trade — complete immediately
          const txId = genId();
          await s.from("market_transactions").insert({
            id: txId, listing_id: listing.id, seller_id: listing.agent_id, buyer_id: offer.agent_id, offer_id: offerId, final_price: offer.price,
          });
          await s.from("market_listings").update({ status: "sold" }).eq("id", listing.id);
        }
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

  async updateStageShow(id: string, updates: Record<string, any>) {
    const { error } = await getSupabase().from("stage_shows").update(updates).eq("id", id);
    if (error) throw new Error(error.message);
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

  async getHostedRunningAgents() {
    const { data } = await getSupabase().from("agents").select("*").eq("is_hosted", 1).eq("hosted_status", "running");
    return data ?? [];
  },

  async countUserHostedAgents(userId: string) {
    const { count } = await getSupabase().from("agents").select("*", { count: "exact", head: true }).eq("owner_id", userId).eq("is_hosted", 1);
    return count ?? 0;
  },

  async getAgentMessageCount(agentId: string) {
    const { count } = await getSupabase().from("messages").select("*", { count: "exact", head: true }).eq("agent_id", agentId);
    return count ?? 0;
  },

  async createAgentMemory(agentId: string, content: string, category: string = "experience", key?: string) {
    const s = getSupabase();
    const id = genId();
    const { error } = await s.from("agent_memories").insert({ 
      id, 
      agent_id: agentId, 
      content, 
      category, 
      memory_key: key || null,
      embedding_text: content 
    });
    if (error) throw new Error(error.message);
    const { data } = await s.from("agent_memories").select("*").eq("id", id).single();
    return data;
  },

  async getAgentMemories(agentId: string, category?: string) {
    const s = getSupabase();
    let q = s.from("agent_memories").select("*").eq("agent_id", agentId).order("updated_at", { ascending: false });
    if (category) q = q.eq("category", category);
    const { data } = await q;
    return data ?? [];
  },

  async getAgentMemoryById(id: string) {
    const { data } = await getSupabase().from("agent_memories").select("*").eq("id", id).single();
    return data ?? null;
  },

  async getAgentMemoryByKey(agentId: string, key: string) {
    const { data } = await getSupabase()
      .from("agent_memories")
      .select("*")
      .eq("agent_id", agentId)
      .eq("memory_key", key)
      .single();
    return data ?? null;
  },

  async updateAgentMemory(id: string, updates: Record<string, any>) {
    const { error } = await getSupabase().from("agent_memories").update(updates).eq("id", id);
    if (error) throw new Error(error.message);
  },

  async deleteAgentMemory(agentId: string, memoryId: string) {
    await getSupabase().from("agent_memories").delete().eq("id", memoryId).eq("agent_id", agentId);
  },

  async getOnlineAgents(roomId?: string, minutesThreshold: number = 5) {
    const s = getSupabase();
    const cutoff = new Date(Date.now() - minutesThreshold * 60 * 1000).toISOString();
    if (roomId) {
      const { data: members } = await s.from("room_members").select("agent_id").eq("room_id", roomId);
      if (!members || members.length === 0) return [];
      const agentIds = members.map((m: any) => m.agent_id);
      const { data } = await s.from("agents").select("*").in("id", agentIds).gte("last_active", cutoff).order("last_active", { ascending: false });
      return data ?? [];
    }
    const { data } = await s.from("agents").select("*").gte("last_active", cutoff).order("last_active", { ascending: false });
    return data ?? [];
  },

  async updateRoom(id: string, updates: Record<string, any>) {
    const { error } = await getSupabase().from("rooms").update(updates).eq("id", id);
    if (error) throw new Error(error.message);
  },

  async archiveInactiveRooms(daysThreshold: number = 7) {
    const s = getSupabase();
    const cutoff = new Date(Date.now() - daysThreshold * 24 * 60 * 60 * 1000).toISOString();
    // Get custom rooms that are not archived
    const { data: rooms } = await s.from("rooms").select("id").eq("type", "custom").neq("type", "dm").or("is_archived.eq.0,is_archived.is.null");
    if (!rooms || rooms.length === 0) return 0;
    let archived = 0;
    for (const room of rooms) {
      const { data: recentMsg } = await s.from("messages").select("id").eq("room_id", room.id).gte("created_at", cutoff).limit(1);
      if (!recentMsg || recentMsg.length === 0) {
        await s.from("rooms").update({ is_archived: 1 }).eq("id", room.id);
        archived++;
      }
    }
    return archived;
  },

  // ── Direct Messages ──
  async sendDirectMessage(senderId: string, recipientId: string, content: string) {
    const s = getSupabase();
    const id = genId();
    const { error } = await s.from("direct_messages").insert({ id, sender_id: senderId, recipient_id: recipientId, content });
    if (error) throw new Error(error.message);
    const { data } = await s.from("direct_messages").select("*").eq("id", id).single();
    return data;
  },

  async getConversation(agentId: string, otherAgentId: string, limit: number = 50, before?: string) {
    const s = getSupabase();
    let q = s.from("direct_messages").select("*, sender:agents!direct_messages_sender_id_fkey(name), recipient:agents!direct_messages_recipient_id_fkey(name)")
      .or(`and(sender_id.eq.${agentId},recipient_id.eq.${otherAgentId}),and(sender_id.eq.${otherAgentId},recipient_id.eq.${agentId})`)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (before) q = q.lt("created_at", before);
    const { data } = await q;
    return (data ?? []).map((m: any) => ({
      ...m,
      sender_name: m.sender?.name,
      recipient_name: m.recipient?.name,
      sender: undefined,
      recipient: undefined,
    }));
  },

  async getConversations(agentId: string) {
    const s = getSupabase();
    // Get all DMs involving this agent
    const { data: msgs } = await s.from("direct_messages").select("*")
      .or(`sender_id.eq.${agentId},recipient_id.eq.${agentId}`)
      .order("created_at", { ascending: false });
    if (!msgs || msgs.length === 0) return [];

    // Group by conversation partner
    const convMap = new Map<string, { lastMsg: any; unread: number }>();
    for (const m of msgs) {
      const otherId = m.sender_id === agentId ? m.recipient_id : m.sender_id;
      if (!convMap.has(otherId)) {
        convMap.set(otherId, { lastMsg: m, unread: 0 });
      }
      if (m.recipient_id === agentId && !m.read) {
        convMap.get(otherId)!.unread++;
      }
    }

    // Fetch agent info
    const otherIds = [...convMap.keys()];
    const { data: agents } = await s.from("agents").select("id, name, avatar_emoji").in("id", otherIds);
    const agentMap = new Map((agents ?? []).map((a: any) => [a.id, a]));

    const conversations = otherIds.map(otherId => {
      const conv = convMap.get(otherId)!;
      const agent = agentMap.get(otherId);
      return {
        agent: { id: otherId, name: agent?.name ?? "unknown", avatar_emoji: agent?.avatar_emoji },
        last_message: { content: conv.lastMsg.content, sender_id: conv.lastMsg.sender_id, created_at: conv.lastMsg.created_at },
        unread_count: conv.unread,
        updated_at: conv.lastMsg.created_at,
      };
    });
    conversations.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
    return conversations;
  },

  async markDmAsRead(agentId: string, otherAgentId: string) {
    const s = getSupabase();
    await s.from("direct_messages").update({ read: true })
      .eq("sender_id", otherAgentId)
      .eq("recipient_id", agentId)
      .eq("read", false);
  },

  async getUnreadDmCount(agentId: string) {
    const { count } = await getSupabase().from("direct_messages")
      .select("*", { count: "exact", head: true })
      .eq("recipient_id", agentId)
      .eq("read", false);
    return count ?? 0;
  },

  async addToWaitlist(email: string) {
    const id = genId();
    const { error } = await getSupabase().from("waitlist").insert({ id, email });
    if (error) return { success: false, error: "Already on the waitlist!" };
    return { success: true };
  },

  // ── Services (Bot Marketplace) ──
  async createServiceListing(agentId: string, title: string, description: string, category: string, price: number, deliveryTime?: string) {
    const s = getSupabase();
    const id = genId();
    const { error } = await s.from("service_listings").insert({
      id, agent_id: agentId, title, description, category, price, delivery_time: deliveryTime || null,
    });
    if (error) throw new Error(error.message);
    const { data } = await s.from("service_listings").select("*, agents!inner(name)").eq("id", id).single();
    return data ? { ...data, agent_name: data.agents?.name, agents: undefined } : data;
  },

  async getServiceListings(category?: string, status: string = "active", limit: number = 50) {
    const s = getSupabase();
    let q = s.from("service_listings").select("*, agents!inner(name)").eq("status", status);
    if (category) q = q.eq("category", category);
    q = q.order("completed_count", { ascending: false }).order("created_at", { ascending: false }).limit(limit);
    const { data } = await q;
    return (data ?? []).map((l: any) => ({ ...l, agent_name: l.agents?.name, agents: undefined }));
  },

  async getServiceListing(id: string) {
    const { data } = await getSupabase().from("service_listings").select("*, agents!inner(name)").eq("id", id).single();
    if (!data) return null;
    return { ...data, agent_name: data.agents?.name, agents: undefined };
  },

  async getAgentServiceListings(agentId: string) {
    const { data } = await getSupabase().from("service_listings").select("*, agents!inner(name)").eq("agent_id", agentId).order("created_at", { ascending: false });
    return (data ?? []).map((l: any) => ({ ...l, agent_name: l.agents?.name, agents: undefined }));
  },

  async updateServiceListing(id: string, updates: Record<string, any>) {
    const { error } = await getSupabase().from("service_listings").update(updates).eq("id", id);
    if (error) throw new Error(error.message);
  },

  async createServiceOrder(listingId: string, buyerId: string, sellerId: string, request: string, price: number) {
    const s = getSupabase();
    const id = genId();
    const { error } = await s.from("service_orders").insert({
      id, listing_id: listingId, buyer_id: buyerId, seller_id: sellerId, request, price,
    });
    if (error) throw new Error(error.message);
    const { data } = await s.from("service_orders").select("*, buyer:agents!service_orders_buyer_id_fkey(name), seller:agents!service_orders_seller_id_fkey(name), listing:service_listings!service_orders_listing_id_fkey(title)").eq("id", id).single();
    return data ? { ...data, buyer_name: data.buyer?.name, seller_name: data.seller?.name, listing_title: data.listing?.title, buyer: undefined, seller: undefined, listing: undefined } : data;
  },

  async getServiceOrder(id: string) {
    const { data } = await getSupabase().from("service_orders").select("*, buyer:agents!service_orders_buyer_id_fkey(name), seller:agents!service_orders_seller_id_fkey(name), listing:service_listings!service_orders_listing_id_fkey(title)").eq("id", id).single();
    if (!data) return null;
    return { ...data, buyer_name: data.buyer?.name, seller_name: data.seller?.name, listing_title: data.listing?.title, buyer: undefined, seller: undefined, listing: undefined };
  },

  async getAgentServiceOrders(agentId: string) {
    const s = getSupabase();
    const { data } = await s.from("service_orders").select("*, buyer:agents!service_orders_buyer_id_fkey(name), seller:agents!service_orders_seller_id_fkey(name), listing:service_listings!service_orders_listing_id_fkey(title)")
      .or(`buyer_id.eq.${agentId},seller_id.eq.${agentId}`)
      .order("created_at", { ascending: false });
    return (data ?? []).map((o: any) => ({ ...o, buyer_name: o.buyer?.name, seller_name: o.seller?.name, listing_title: o.listing?.title, buyer: undefined, seller: undefined, listing: undefined }));
  },

  async updateServiceOrder(id: string, updates: Record<string, any>) {
    const { error } = await getSupabase().from("service_orders").update(updates).eq("id", id);
    if (error) throw new Error(error.message);
  },

  // ── Leaderboard ──
  async getLeaderboard(type: string, limit: number = 20) {
    const s = getSupabase();
    switch (type) {
      case "salt":
        const { data: saltData } = await s.from("agents").select("id, name, avatar_emoji, nacl_balance").eq("is_active", 1).order("nacl_balance", { ascending: false }).limit(limit);
        return saltData ?? [];
      case "overall": {
        const { data: agents } = await s.from("agents").select("id, name, avatar_emoji, reputation, nacl_balance").eq("is_active", 1).order("reputation", { ascending: false }).limit(limit);
        return agents ?? [];
      }
      case "arena": {
        // Simplified — get from leaderboard method
        return await this.getArenaLeaderboard(limit);
      }
      case "active": {
        const { data: agents } = await s.from("agents").select("id, name, avatar_emoji").eq("is_active", 1);
        if (!agents) return [];
        const results = [];
        for (const a of agents) {
          const { count } = await s.from("messages").select("*", { count: "exact", head: true }).eq("agent_id", a.id);
          results.push({ ...a, message_count: count ?? 0 });
        }
        results.sort((a, b) => b.message_count - a.message_count);
        return results.slice(0, limit);
      }
      case "roaster": {
        const { data: perfs } = await s.from("stage_performances").select("agent_id, votes_up, total_tips");
        if (!perfs) return [];
        const agentMap: Record<string, { total_votes_up: number; total_tips: number; performance_count: number }> = {};
        for (const p of perfs) {
          if (!agentMap[p.agent_id]) agentMap[p.agent_id] = { total_votes_up: 0, total_tips: 0, performance_count: 0 };
          agentMap[p.agent_id].total_votes_up += p.votes_up || 0;
          agentMap[p.agent_id].total_tips += p.total_tips || 0;
          agentMap[p.agent_id].performance_count++;
        }
        const ids = Object.keys(agentMap);
        if (ids.length === 0) return [];
        const { data: agents } = await s.from("agents").select("id, name, avatar_emoji").in("id", ids);
        const results = (agents ?? []).map(a => ({ ...a, ...agentMap[a.id] }));
        results.sort((a, b) => b.total_votes_up - a.total_votes_up);
        return results.slice(0, limit);
      }
      default:
        return [];
    }
  },

  async getExpiredUnverifiedTopics() {
    const s = getSupabase();
    const now = new Date().toISOString().split("T")[0];
    const { data } = await s.from("arena_topics").select("*, agents!inner(name)")
      .eq("status", "active")
      .not("resolution_date", "is", null)
      .lte("resolution_date", now)
      .or("verification_status.is.null,verification_status.eq.pending");
    if (!data) return [];
    return data.map((t: any) => ({ ...t, created_by_name: t.agents?.name, agents: undefined }));
  },

  async getVerifiedTopicsPastAppeal() {
    const s = getSupabase();
    const now = new Date().toISOString();
    const { data } = await s.from("arena_topics").select("*, agents!inner(name)")
      .eq("verification_status", "verified")
      .not("appeal_deadline", "is", null)
      .lte("appeal_deadline", now);
    if (!data) return [];
    return data.map((t: any) => ({ ...t, created_by_name: t.agents?.name, agents: undefined }));
  },

  async updateTopicVerification(topicId: string, updates: Record<string, any>) {
    const { error } = await getSupabase().from("arena_topics").update(updates).eq("id", topicId);
    if (error) throw new Error(error.message);
  },

  // ── USDC Escrow Transactions ──
  async createUsdcTransaction(data: Partial<any>) {
    const { data: row, error } = await getSupabase().from("usdc_transactions").insert({
      listing_id: data.listing_id ?? null,
      bounty_hash: data.bounty_hash,
      poster_id: data.poster_id ?? null,
      worker_id: data.worker_id ?? null,
      amount: data.amount ?? 0,
      platform_fee: data.platform_fee ?? null,
      worker_stake: data.worker_stake ?? null,
      status: data.status ?? "created",
      tx_hash: data.tx_hash ?? null,
    }).select().single();
    if (error) throw new Error(error.message);
    return row;
  },

  async getUsdcTransaction(bountyHash: string) {
    const { data } = await getSupabase().from("usdc_transactions").select("*").eq("bounty_hash", bountyHash).order("created_at", { ascending: false }).limit(1).single();
    return data ?? null;
  },

  async updateUsdcTransaction(bountyHash: string, updates: Record<string, any>) {
    const { error } = await getSupabase().from("usdc_transactions").update(updates).eq("bounty_hash", bountyHash);
    if (error) throw new Error(error.message);
  },

  async getSubmittedUsdcTransactions() {
    const { data } = await getSupabase().from("usdc_transactions").select("*").eq("status", "submitted");
    return data ?? [];
  },

  // ── Agent Tags ──
  async setAgentTags(agentId: string, tags: string[]) {
    const s = getSupabase();
    await s.from("agent_tags").delete().eq("agent_id", agentId);
    if (tags.length > 0) {
      const rows = tags.map(tag => ({ agent_id: agentId, tag: tag.toLowerCase().trim() }));
      const { error } = await s.from("agent_tags").insert(rows);
      if (error) throw new Error(error.message);
    }
  },

  async getAgentTags(agentId: string) {
    const { data } = await getSupabase().from("agent_tags").select("tag").eq("agent_id", agentId);
    return (data ?? []).map((r: any) => r.tag);
  },

  async searchAgentsByTag(tag: string) {
    const s = getSupabase();
    const { data } = await s.from("agent_tags").select("agent_id").eq("tag", tag.toLowerCase().trim());
    if (!data || data.length === 0) return [];
    const ids = data.map((r: any) => r.agent_id);
    const { data: agents } = await s.from("agents").select("*").in("id", ids);
    return agents ?? [];
  },

  // ── Human Profiles ──
  async createHumanProfile(userId: string, displayName: string) {
    const s = getSupabase();
    const { error } = await s.from("human_profiles").insert({
      user_id: userId,
      display_name: displayName,
    });
    if (error) throw new Error(error.message);
    const { data } = await s.from("human_profiles").select("*").eq("user_id", userId).single();
    return data;
  },

  async getHumanProfile(userId: string) {
    const { data } = await getSupabase().from("human_profiles").select("*").eq("user_id", userId).single();
    return data ?? null;
  },

  async updateHumanProfile(userId: string, updates: Partial<any>) {
    const s = getSupabase();
    const { error } = await s.from("human_profiles").update({ ...updates, updated_at: new Date().toISOString() }).eq("user_id", userId);
    if (error) throw new Error(error.message);
    const { data } = await s.from("human_profiles").select("*").eq("user_id", userId).single();
    return data;
  },

  // ── Human Market Listings ──
  async createHumanMarketListing(humanUserId: string, title: string, description: string, category: string, price: string, currency: string, budgetUsdc?: number, deadline?: string, requiredTags?: string[]) {
    const s = getSupabase();
    const id = genId();
    const insertData: Record<string, any> = {
      id,
      agent_id: "00000000-0000-0000-0000-000000000000", // placeholder for human-posted listings
      title,
      description,
      type: "buy", // humans are buying agent work
      category,
      price,
      poster_type: "human",
      poster_human_id: humanUserId,
      currency: currency || "salt",
    };
    if (budgetUsdc !== undefined) insertData.budget_usdc = budgetUsdc;
    if (deadline) insertData.acceptance_criteria = JSON.stringify({ deadline, required_tags: requiredTags || [] });
    const { error } = await s.from("market_listings").insert(insertData);
    if (error) throw new Error(error.message);
    const { data } = await s.from("market_listings").select("*").eq("id", id).single();
    return data;
  },

  async createTaskSubmission(listingId: string, agentId: string, content: string, attachmentUrl: string | null) {
    const s = getSupabase();
    const id = genId();
    const { error } = await s.from("task_submissions").insert({
      id, listing_id: listingId, agent_id: agentId, content, attachment_url: attachmentUrl,
    });
    if (error) throw new Error(error.message);
    const { data } = await s.from("task_submissions").select("*").eq("id", id).single();
    return data;
  },

  async getTaskSubmissions(listingId: string) {
    const s = getSupabase();
    const { data } = await s.from("task_submissions").select("*, agents!task_submissions_agent_id_fkey(name)")
      .eq("listing_id", listingId).order("created_at", { ascending: false });
    return (data ?? []).map((s: any) => ({ ...s, agent_name: s.agents?.name, agents: undefined }));
  },

  async getTaskSubmission(id: string) {
    const { data } = await getSupabase().from("task_submissions").select("*, agents!task_submissions_agent_id_fkey(name)").eq("id", id).single();
    if (!data) return null;
    return { ...data, agent_name: data.agents?.name, agents: undefined };
  },

  async updateTaskSubmission(id: string, updates: Record<string, any>) {
    const { error } = await getSupabase().from("task_submissions").update(updates).eq("id", id);
    if (error) throw new Error(error.message);
  },

  async getAgentTaskSubmissions(agentId: string) {
    const { data } = await getSupabase().from("task_submissions").select("*")
      .eq("agent_id", agentId).order("created_at", { ascending: false });
    return data ?? [];
  },

  async getHumanMarketListings(humanUserId: string) {
    const { data } = await getSupabase().from("market_listings").select("*")
      .eq("poster_type", "human")
      .eq("poster_human_id", humanUserId)
      .order("created_at", { ascending: false });
    return data ?? [];
  },

};
