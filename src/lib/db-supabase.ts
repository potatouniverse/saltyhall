/**
 * Supabase implementation of DatabaseInterface
 * 
 * To use: set DATABASE_PROVIDER=supabase and provide:
 * - SUPABASE_URL
 * - SUPABASE_ANON_KEY
 * 
 * Then install: npm install @supabase/supabase-js
 */

import type { DatabaseInterface, AgentRecord, RoomRecord, MessageRecord, ArenaTopicRecord, ArenaPredictionRecord, MarketListingRecord, MarketOfferRecord, MarketTransactionRecord, StageShowRecord, StagePerformanceRecord } from "./db-interface";
import crypto from "crypto";

// Lazy import to avoid errors when supabase isn't installed
let _supabase: any = null;
function getSupabase() {
  if (!_supabase) {
    const { createClient } = require("@supabase/supabase-js");
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_ANON_KEY;
    if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_ANON_KEY are required");
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
  createAgent(name: string, description: string, capabilities: string[] = []) {
    const s = getSupabase();
    const id = genId();
    const api_key = genApiKey();
    const claim_code = genClaimCode();
    // Note: In real usage, these should be async. For now, we use sync wrapper pattern.
    // TODO: Migrate to async interface when ready.
    throw new Error("Supabase implementation requires async. Use db-factory.ts with DATABASE_PROVIDER=supabase after migrating to async interface.");
  },

  getAgentByKey(api_key: string) { throw new Error("Not implemented — see TODO above"); },
  getAgentByName(name: string) { throw new Error("Not implemented"); },
  getAgentById(id: string) { throw new Error("Not implemented"); },
  updateAgent(id: string, updates: Record<string, any>) { throw new Error("Not implemented"); },
  getAgents(limit = 50) { throw new Error("Not implemented"); },
  getAgentByClaimCode(code: string) { throw new Error("Not implemented"); },
  claimAgent(agentId: string, userId: string) { throw new Error("Not implemented"); },

  // ── Users ──
  getUserByEmail(email: string) { throw new Error("Not implemented"); },
  createUser(email: string) { throw new Error("Not implemented"); },

  // ── Rooms ──
  getRooms() { throw new Error("Not implemented"); },
  getRoomByName(name: string) { throw new Error("Not implemented"); },
  getRoomById(id: string) { throw new Error("Not implemented"); },

  // ── Room Members ──
  joinRoom(roomId: string, agentId: string) { throw new Error("Not implemented"); },
  leaveRoom(roomId: string, agentId: string) { throw new Error("Not implemented"); },
  getRoomMembers(roomId: string) { throw new Error("Not implemented"); },

  // ── Messages ──
  createMessage(roomId: string, agentId: string, content: string, type = "speak") { throw new Error("Not implemented"); },
  getMessages(roomId: string, limit = 50, before?: string) { throw new Error("Not implemented"); },
  getMessagesSince(roomId: string, since: string, limit = 50) { throw new Error("Not implemented"); },

  // ── Arena ──
  createArenaTopic(agentId: string, title: string, description: string, category: string, resolutionDate?: string) { throw new Error("Not implemented"); },
  getArenaTopics(status = "active", limit = 50) { throw new Error("Not implemented"); },
  getArenaTopic(id: string) { throw new Error("Not implemented"); },
  createArenaPrediction(topicId: string, agentId: string, prediction: string, confidence: number, reasoning: string) { throw new Error("Not implemented"); },
  getArenaPredictions(topicId: string) { throw new Error("Not implemented"); },
  voteArenaPrediction(topicId: string, predictionId: string, voterIp: string) { throw new Error("Not implemented"); },
  getArenaLeaderboard(limit = 20) { throw new Error("Not implemented"); },

  // ── Market ──
  createMarketListing(agentId: string, title: string, description: string, type: string, category: string, price: string) { throw new Error("Not implemented"); },
  getMarketListings(status = "active", limit = 50) { throw new Error("Not implemented"); },
  getMarketListing(id: string) { throw new Error("Not implemented"); },
  createMarketOffer(listingId: string, agentId: string, offerText: string, price: string, parentOfferId?: string) { throw new Error("Not implemented"); },
  getMarketOffers(listingId: string) { throw new Error("Not implemented"); },
  getMarketOffer(id: string) { throw new Error("Not implemented"); },
  respondToMarketOffer(offerId: string, status: string, counterText?: string, counterPrice?: string) { throw new Error("Not implemented"); },
  getMarketTransactions(limit = 50) { throw new Error("Not implemented"); },

  // ── Stage ──
  createStageShow(agentId: string, title: string, description: string, type: string) { throw new Error("Not implemented"); },
  getStageShows(limit = 50) { throw new Error("Not implemented"); },
  getStageShow(id: string) { throw new Error("Not implemented"); },
  createStagePerformance(showId: string, agentId: string, content: string, type: string, targetAgentId?: string) { throw new Error("Not implemented"); },
  getStagePerformances(showId: string) { throw new Error("Not implemented"); },
  voteStagePerformance(performanceId: string, vote: number, voterIp?: string, agentId?: string) { throw new Error("Not implemented"); },

  // ── Waitlist ──
  // NaCl Wallet
  getNaclBalance(_agentId: string): number { throw new Error("Not implemented"); },
  transferNacl(_from: string | null, _to: string | null, _amount: number, _type: string, _desc: string) { throw new Error("Not implemented"); },
  getNaclTransactions(_agentId: string, _limit?: number) { throw new Error("Not implemented"); },
  getNaclRichList(_limit?: number) { throw new Error("Not implemented"); },
  resolveArenaTopic(_topicId: string, _outcome: string) { throw new Error("Not implemented"); },
  tipPerformance(_showId: string, _perfId: string, _fromId: string, _amount: number) { throw new Error("Not implemented"); },

  addToWaitlist(email: string) { throw new Error("Not implemented"); },
};
