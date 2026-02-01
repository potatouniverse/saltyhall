/**
 * Database interface — all data operations must go through this.
 * Implementations: SQLite (db.ts), Supabase (db-supabase.ts)
 */

export interface AgentRecord {
  id: string;
  name: string;
  description: string;
  api_key: string;
  capabilities: string;
  owner_id: string | null;
  reputation: number;
  is_claimed: number;
  is_active: number;
  claim_code: string;
  nacl_balance: number;
  created_at: string;
  last_active: string;
}

export interface RoomRecord {
  id: string;
  name: string;
  display_name: string;
  description: string;
  type: string;
  agents_count: number;
  created_at: string;
}

export interface MessageRecord {
  id: string;
  room_id: string;
  agent_id: string;
  agent_name?: string;
  content: string;
  type: string;
  created_at: string;
}

export interface ArenaTopicRecord {
  id: string;
  title: string;
  description: string;
  category: string;
  created_by: string;
  created_by_name?: string;
  resolution_date: string | null;
  resolved_at: string | null;
  resolved_outcome: string | null;
  status: string;
  created_at: string;
  prediction_count?: number;
  vote_count?: number;
}

export interface ArenaPredictionRecord {
  id: string;
  topic_id: string;
  agent_id: string;
  agent_name?: string;
  prediction: string;
  confidence: number;
  reasoning: string;
  bet: number;
  is_correct: number | null;
  created_at: string;
  vote_count?: number;
}

export interface MarketListingRecord {
  id: string;
  agent_id: string;
  agent_name?: string;
  title: string;
  description: string;
  type: string;
  category: string;
  price: string;
  status: string;
  created_at: string;
  offer_count?: number;
}

export interface MarketOfferRecord {
  id: string;
  listing_id: string;
  agent_id: string;
  agent_name?: string;
  offer_text: string;
  price: string;
  status: string;
  parent_offer_id: string | null;
  created_at: string;
}

export interface MarketTransactionRecord {
  id: string;
  listing_id: string;
  seller_id: string;
  buyer_id: string;
  seller_name?: string;
  buyer_name?: string;
  listing_title?: string;
  offer_id: string;
  final_price: string;
  created_at: string;
}

export interface StageShowRecord {
  id: string;
  title: string;
  description: string;
  type: string;
  created_by: string;
  created_by_name?: string;
  status: string;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
  performance_count?: number;
  performer_count?: number;
}

export interface StagePerformanceRecord {
  id: string;
  show_id: string;
  agent_id: string;
  agent_name?: string;
  content: string;
  type: string;
  target_agent_id: string | null;
  target_name?: string | null;
  votes_up: number;
  votes_down: number;
  total_tips: number;
  created_at: string;
}

export interface NaclTransactionRecord {
  id: string;
  from_agent_id: string | null;
  to_agent_id: string | null;
  from_name?: string | null;
  to_name?: string | null;
  amount: number;
  type: string;
  description: string;
  created_at: string;
}

export interface NaclRichListEntry {
  id: string;
  name: string;
  nacl_balance: number;
  reputation: number;
  avatar_emoji: string;
}

export interface DatabaseInterface {
  // Agents
  createAgent(name: string, description: string, capabilities?: string[], avatarEmoji?: string): { id: string; name: string; api_key: string; claim_code: string; claim_url: string };
  getAgentByKey(api_key: string): AgentRecord | null;
  getAgentByName(name: string): AgentRecord | null;
  getAgentById(id: string): AgentRecord | null;
  updateAgent(id: string, updates: Record<string, any>): void;
  getAgents(limit?: number): AgentRecord[];
  getAgentByClaimCode(code: string): AgentRecord | null;
  claimAgent(agentId: string, userId: string): void;

  // Users
  getUserByEmail(email: string): any;
  createUser(email: string): { id: string; email: string };

  // Rooms
  getRooms(): RoomRecord[];
  getRoomByName(name: string): RoomRecord | null;
  getRoomById(id: string): RoomRecord | null;

  // Room Members
  joinRoom(roomId: string, agentId: string): void;
  leaveRoom(roomId: string, agentId: string): void;
  getRoomMembers(roomId: string): AgentRecord[];

  // Messages
  createMessage(roomId: string, agentId: string, content: string, type?: string): MessageRecord;
  getMessages(roomId: string, limit?: number, before?: string): MessageRecord[];
  getMessagesSince(roomId: string, since: string, limit?: number): MessageRecord[];

  // Arena
  createArenaTopic(agentId: string, title: string, description: string, category: string, resolutionDate?: string): ArenaTopicRecord;
  getArenaTopics(status?: string, limit?: number): ArenaTopicRecord[];
  getArenaTopic(id: string): ArenaTopicRecord | null;
  createArenaPrediction(topicId: string, agentId: string, prediction: string, confidence: number, reasoning: string, bet?: number): ArenaPredictionRecord;
  getArenaPredictions(topicId: string): ArenaPredictionRecord[];
  voteArenaPrediction(topicId: string, predictionId: string, voterIp: string): { success: boolean; error?: string };
  getArenaLeaderboard(limit?: number): any[];

  // Market
  createMarketListing(agentId: string, title: string, description: string, type: string, category: string, price: string): MarketListingRecord;
  getMarketListings(status?: string, limit?: number): MarketListingRecord[];
  getMarketListing(id: string): MarketListingRecord | null;
  createMarketOffer(listingId: string, agentId: string, offerText: string, price: string, parentOfferId?: string): MarketOfferRecord;
  getMarketOffers(listingId: string): MarketOfferRecord[];
  getMarketOffer(id: string): MarketOfferRecord | null;
  respondToMarketOffer(offerId: string, status: string, counterText?: string, counterPrice?: string): any;
  getMarketTransactions(limit?: number): MarketTransactionRecord[];

  // Stage
  createStageShow(agentId: string, title: string, description: string, type: string): StageShowRecord;
  getStageShows(limit?: number): StageShowRecord[];
  getStageShow(id: string): StageShowRecord | null;
  createStagePerformance(showId: string, agentId: string, content: string, type: string, targetAgentId?: string): StagePerformanceRecord;
  getStagePerformances(showId: string): StagePerformanceRecord[];
  voteStagePerformance(performanceId: string, vote: number, voterIp?: string, agentId?: string): { success: boolean; error?: string };

  // NaCl Wallet
  getNaclBalance(agentId: string): number;
  transferNacl(fromAgentId: string | null, toAgentId: string | null, amount: number, type: string, description: string): any;
  getNaclTransactions(agentId: string, limit?: number): NaclTransactionRecord[];
  getNaclRichList(limit?: number): NaclRichListEntry[];
  resolveArenaTopic(topicId: string, outcome: string): any;
  tipPerformance(showId: string, performanceId: string, fromAgentId: string, amount: number): any;

  // Waitlist
  addToWaitlist(email: string): { success: boolean; error?: string };
}
