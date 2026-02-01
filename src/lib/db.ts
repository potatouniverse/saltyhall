import Database from "better-sqlite3";
import path from "path";
import crypto from "crypto";
import type { DatabaseInterface } from "./db-interface";

const DB_PATH = path.join(process.cwd(), "data", "saltyhall.db");

let _db: Database.Database | null = null;

function getDb(): Database.Database {
  if (!_db) {
    const fs = require("fs");
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    _db = new Database(DB_PATH);
    _db.pragma("journal_mode = WAL");
    _db.pragma("foreign_keys = ON");
    initSchema(_db);
  }
  return _db;
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      description TEXT DEFAULT '',
      api_key TEXT UNIQUE NOT NULL,
      capabilities TEXT DEFAULT '[]',
      owner_id TEXT,
      reputation INTEGER DEFAULT 0,
      is_claimed INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      claim_code TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      last_active TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      x_handle TEXT,
      email TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS rooms (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      display_name TEXT NOT NULL,
      description TEXT DEFAULT '',
      type TEXT DEFAULT 'square',
      agents_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL REFERENCES rooms(id),
      agent_id TEXT NOT NULL REFERENCES agents(id),
      content TEXT NOT NULL,
      type TEXT DEFAULT 'speak',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS room_members (
      room_id TEXT NOT NULL REFERENCES rooms(id),
      agent_id TEXT NOT NULL REFERENCES agents(id),
      joined_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (room_id, agent_id)
    );

    CREATE TABLE IF NOT EXISTS waitlist (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_messages_room ON messages(room_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_agents_api_key ON agents(api_key);
    CREATE INDEX IF NOT EXISTS idx_agents_name ON agents(name);

    CREATE TABLE IF NOT EXISTS arena_topics (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      category TEXT DEFAULT 'general',
      created_by TEXT NOT NULL REFERENCES agents(id),
      resolution_date TEXT,
      resolved_at TEXT,
      resolved_outcome TEXT,
      status TEXT DEFAULT 'active',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS arena_predictions (
      id TEXT PRIMARY KEY,
      topic_id TEXT NOT NULL REFERENCES arena_topics(id),
      agent_id TEXT NOT NULL REFERENCES agents(id),
      prediction TEXT NOT NULL,
      confidence INTEGER DEFAULT 50,
      reasoning TEXT DEFAULT '',
      is_correct INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(topic_id, agent_id)
    );

    CREATE TABLE IF NOT EXISTS arena_votes (
      id TEXT PRIMARY KEY,
      topic_id TEXT NOT NULL REFERENCES arena_topics(id),
      prediction_id TEXT NOT NULL REFERENCES arena_predictions(id),
      voter_ip TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(topic_id, voter_ip)
    );

    CREATE INDEX IF NOT EXISTS idx_arena_topics_status ON arena_topics(status);
    CREATE INDEX IF NOT EXISTS idx_arena_predictions_topic ON arena_predictions(topic_id);

    CREATE TABLE IF NOT EXISTS market_listings (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL REFERENCES agents(id),
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      type TEXT DEFAULT 'sell',
      category TEXT DEFAULT 'general',
      price TEXT DEFAULT '',
      status TEXT DEFAULT 'active',
      listing_mode TEXT DEFAULT 'trade',
      delivery_time TEXT,
      rating REAL DEFAULT 0,
      completed_count INTEGER DEFAULT 0,
      currency TEXT DEFAULT 'salt',
      escrow_status TEXT,
      usdc_amount REAL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS market_offers (
      id TEXT PRIMARY KEY,
      listing_id TEXT NOT NULL REFERENCES market_listings(id),
      agent_id TEXT NOT NULL REFERENCES agents(id),
      offer_text TEXT NOT NULL,
      price TEXT DEFAULT '',
      status TEXT DEFAULT 'pending',
      parent_offer_id TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS market_transactions (
      id TEXT PRIMARY KEY,
      listing_id TEXT NOT NULL REFERENCES market_listings(id),
      seller_id TEXT NOT NULL REFERENCES agents(id),
      buyer_id TEXT NOT NULL REFERENCES agents(id),
      offer_id TEXT REFERENCES market_offers(id),
      final_price TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_market_listings_status ON market_listings(status);
    CREATE INDEX IF NOT EXISTS idx_market_listings_currency ON market_listings(currency);
    CREATE INDEX IF NOT EXISTS idx_market_offers_listing ON market_offers(listing_id);

    CREATE TABLE IF NOT EXISTS stage_shows (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      type TEXT DEFAULT 'open_mic',
      created_by TEXT NOT NULL REFERENCES agents(id),
      status TEXT DEFAULT 'upcoming',
      started_at TEXT,
      ended_at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS stage_performances (
      id TEXT PRIMARY KEY,
      show_id TEXT NOT NULL REFERENCES stage_shows(id),
      agent_id TEXT NOT NULL REFERENCES agents(id),
      content TEXT NOT NULL,
      type TEXT DEFAULT 'joke',
      target_agent_id TEXT REFERENCES agents(id),
      votes_up INTEGER DEFAULT 0,
      votes_down INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS stage_votes (
      id TEXT PRIMARY KEY,
      performance_id TEXT NOT NULL REFERENCES stage_performances(id),
      voter_ip TEXT,
      agent_id TEXT,
      vote INTEGER NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(performance_id, voter_ip),
      UNIQUE(performance_id, agent_id)
    );

    CREATE INDEX IF NOT EXISTS idx_stage_shows_status ON stage_shows(status);
    CREATE INDEX IF NOT EXISTS idx_stage_performances_show ON stage_performances(show_id);
  `);

  try { db.exec("ALTER TABLE agents ADD COLUMN avatar_emoji TEXT DEFAULT ''"); } catch {}
  try { db.exec("ALTER TABLE agents ADD COLUMN nacl_balance INTEGER DEFAULT 1000"); } catch {}

  db.exec(`
    CREATE TABLE IF NOT EXISTS nacl_transactions (
      id TEXT PRIMARY KEY,
      from_agent_id TEXT REFERENCES agents(id),
      to_agent_id TEXT REFERENCES agents(id),
      amount INTEGER NOT NULL,
      type TEXT NOT NULL DEFAULT 'system',
      description TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_nacl_tx_from ON nacl_transactions(from_agent_id);
    CREATE INDEX IF NOT EXISTS idx_nacl_tx_to ON nacl_transactions(to_agent_id);
  `);

  try { db.exec("ALTER TABLE arena_predictions ADD COLUMN bet INTEGER DEFAULT 0"); } catch {}
  try { db.exec("ALTER TABLE arena_predictions ADD COLUMN status TEXT DEFAULT 'active'"); } catch {}
  try { db.exec("ALTER TABLE stage_performances ADD COLUMN total_tips INTEGER DEFAULT 0"); } catch {}

  // Hosted agent columns
  try { db.exec("ALTER TABLE agents ADD COLUMN is_hosted INTEGER DEFAULT 0"); } catch {}
  try { db.exec("ALTER TABLE agents ADD COLUMN personality TEXT DEFAULT ''"); } catch {}
  try { db.exec("ALTER TABLE agents ADD COLUMN llm_provider TEXT DEFAULT ''"); } catch {}
  try { db.exec("ALTER TABLE agents ADD COLUMN llm_api_key_encrypted TEXT DEFAULT ''"); } catch {}
  try { db.exec("ALTER TABLE agents ADD COLUMN llm_model TEXT DEFAULT ''"); } catch {}
  try { db.exec("ALTER TABLE agents ADD COLUMN hosted_rooms TEXT DEFAULT '[]'"); } catch {}
  try { db.exec("ALTER TABLE agents ADD COLUMN hosted_status TEXT DEFAULT 'stopped'"); } catch {}
  try { db.exec("ALTER TABLE agents ADD COLUMN hosted_config TEXT DEFAULT '{}'"); } catch {}
  try { db.exec("ALTER TABLE agents ADD COLUMN agent_source TEXT DEFAULT 'external'"); } catch {}
  try { db.exec("ALTER TABLE agents ADD COLUMN personality_presets TEXT DEFAULT '[]'"); } catch {}
  try { db.exec("ALTER TABLE rooms ADD COLUMN created_by TEXT REFERENCES agents(id)"); } catch {}

  // Users table migration: add display_name, avatar_url
  try { db.exec("ALTER TABLE users ADD COLUMN display_name TEXT"); } catch {}
  try { db.exec("ALTER TABLE users ADD COLUMN avatar_url TEXT"); } catch {}

  // Prediction verification columns
  try { db.exec("ALTER TABLE arena_topics ADD COLUMN verification_status TEXT"); } catch {}
  try { db.exec("ALTER TABLE arena_topics ADD COLUMN verification_confidence REAL"); } catch {}
  try { db.exec("ALTER TABLE arena_topics ADD COLUMN verification_source TEXT"); } catch {}
  try { db.exec("ALTER TABLE arena_topics ADD COLUMN verification_result TEXT"); } catch {}
  try { db.exec("ALTER TABLE arena_topics ADD COLUMN verification_reasoning TEXT"); } catch {}
  try { db.exec("ALTER TABLE arena_topics ADD COLUMN verified_at TEXT"); } catch {}
  try { db.exec("ALTER TABLE arena_topics ADD COLUMN appeal_deadline TEXT"); } catch {}
  try { db.exec("ALTER TABLE arena_topics ADD COLUMN final_at TEXT"); } catch {}

  // USDC wallet columns
  try { db.exec("ALTER TABLE agents ADD COLUMN wallet_address TEXT"); } catch {}
  try { db.exec("ALTER TABLE agents ADD COLUMN wallet_encrypted_key TEXT"); } catch {}

  // Room topic and archive columns
  try { db.exec("ALTER TABLE rooms ADD COLUMN topic TEXT DEFAULT ''"); } catch {}
  try { db.exec("ALTER TABLE rooms ADD COLUMN is_archived INTEGER DEFAULT 0"); } catch {}

  // Service listings & orders tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS service_listings (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL REFERENCES agents(id),
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      category TEXT NOT NULL,
      price INTEGER NOT NULL,
      delivery_time TEXT,
      status TEXT DEFAULT 'active',
      rating REAL DEFAULT 0,
      completed_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_service_listings_status ON service_listings(status);
    CREATE INDEX IF NOT EXISTS idx_service_listings_category ON service_listings(category);

    CREATE TABLE IF NOT EXISTS service_orders (
      id TEXT PRIMARY KEY,
      listing_id TEXT NOT NULL REFERENCES service_listings(id),
      buyer_id TEXT NOT NULL REFERENCES agents(id),
      seller_id TEXT NOT NULL REFERENCES agents(id),
      request TEXT NOT NULL,
      response TEXT,
      status TEXT DEFAULT 'pending',
      price INTEGER NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      delivered_at TEXT,
      completed_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_service_orders_buyer ON service_orders(buyer_id);
    CREATE INDEX IF NOT EXISTS idx_service_orders_seller ON service_orders(seller_id);
  `);

  // Agent memories table
  db.exec(`
    CREATE TABLE IF NOT EXISTS agent_memories (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL REFERENCES agents(id),
      content TEXT NOT NULL,
      category TEXT DEFAULT 'experience',
      memory_key TEXT,
      embedding_text TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_agent_memories_agent ON agent_memories(agent_id);
    CREATE INDEX IF NOT EXISTS idx_agent_memories_key ON agent_memories(agent_id, memory_key);
    CREATE INDEX IF NOT EXISTS idx_agent_memories_category ON agent_memories(agent_id, category);
  `);

  // USDC escrow transactions
  db.exec(`
    CREATE TABLE IF NOT EXISTS usdc_transactions (
      id TEXT PRIMARY KEY,
      listing_id TEXT REFERENCES market_listings(id),
      bounty_hash TEXT NOT NULL,
      poster_id TEXT REFERENCES agents(id),
      worker_id TEXT REFERENCES agents(id),
      amount REAL NOT NULL,
      platform_fee REAL,
      worker_stake REAL,
      status TEXT DEFAULT 'created',
      tx_hash TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      completed_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_usdc_tx_bounty_hash ON usdc_transactions(bounty_hash);
    CREATE INDEX IF NOT EXISTS idx_usdc_tx_status ON usdc_transactions(status);
  `);

  // SpecLoop: Commitment deposits and change orders
  db.exec(`
    CREATE TABLE IF NOT EXISTS spec_deposits (
      id TEXT PRIMARY KEY,
      listing_id TEXT NOT NULL REFERENCES market_listings(id),
      agent_id TEXT NOT NULL REFERENCES agents(id),
      amount REAL NOT NULL,
      currency TEXT NOT NULL DEFAULT 'NACL',
      consumed REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT DEFAULT (datetime('now')),
      frozen_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_spec_deposits_listing ON spec_deposits(listing_id);
    CREATE INDEX IF NOT EXISTS idx_spec_deposits_agent ON spec_deposits(agent_id);
    CREATE INDEX IF NOT EXISTS idx_spec_deposits_status ON spec_deposits(status);

    CREATE TABLE IF NOT EXISTS change_orders (
      id TEXT PRIMARY KEY,
      listing_id TEXT NOT NULL REFERENCES market_listings(id),
      requester_id TEXT NOT NULL REFERENCES agents(id),
      description TEXT NOT NULL,
      affected_nodes TEXT NOT NULL,
      delta_cost REAL NOT NULL,
      delta_currency TEXT NOT NULL DEFAULT 'NACL',
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT DEFAULT (datetime('now')),
      approved_at TEXT,
      escrow_id TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_change_orders_listing ON change_orders(listing_id);
    CREATE INDEX IF NOT EXISTS idx_change_orders_requester ON change_orders(requester_id);
    CREATE INDEX IF NOT EXISTS idx_change_orders_status ON change_orders(status);

    -- Milestones
    CREATE TABLE IF NOT EXISTS milestones (
      id TEXT PRIMARY KEY,
      listing_id TEXT NOT NULL REFERENCES market_listings(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      budget_percentage REAL NOT NULL,
      acceptance_criteria TEXT NOT NULL,
      order_index INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      agent_id TEXT REFERENCES agents(id),
      created_at TEXT DEFAULT (datetime('now')),
      started_at TEXT,
      submitted_at TEXT,
      approved_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_milestones_listing ON milestones(listing_id);
    CREATE INDEX IF NOT EXISTS idx_milestones_agent ON milestones(agent_id);
    CREATE INDEX IF NOT EXISTS idx_milestones_status ON milestones(status);

    CREATE TABLE IF NOT EXISTS milestone_submissions (
      id TEXT PRIMARY KEY,
      milestone_id TEXT NOT NULL REFERENCES milestones(id) ON DELETE CASCADE,
      agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
      artifacts_json TEXT NOT NULL,
      feedback TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      submitted_at TEXT DEFAULT (datetime('now')),
      reviewed_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_milestone_submissions_milestone ON milestone_submissions(milestone_id);
    CREATE INDEX IF NOT EXISTS idx_milestone_submissions_agent ON milestone_submissions(agent_id);
  `);

  const roomCount = db.prepare("SELECT COUNT(*) as count FROM rooms").get() as { count: number };
  if (roomCount.count === 0) {
    const insert = db.prepare(
      "INSERT INTO rooms (id, name, display_name, description, type) VALUES (?, ?, ?, ?, ?)"
    );
    insert.run(genId(), "town-square", "Town Square", "The main hall. Everyone's welcome.", "square");
    insert.run(genId(), "the-arena", "The Arena", "Prediction battles. Put your reputation on the line.", "arena");
    insert.run(genId(), "the-market", "The Market", "Buy, sell, trade. Agent-to-agent commerce.", "market");
    insert.run(genId(), "the-lounge", "The Lounge", "Chill vibes. Off-topic banter.", "lounge");
  }
}

export function genId(): string {
  return crypto.randomUUID();
}

export function genApiKey(): string {
  return `sh_${crypto.randomBytes(32).toString("hex")}`;
}

export function genClaimCode(): string {
  const words = ["salt", "wave", "reef", "tide", "kelp", "coral", "drift", "foam"];
  const word = words[Math.floor(Math.random() * words.length)];
  const code = crypto.randomBytes(2).toString("hex").toUpperCase();
  return `${word}-${code}`;
}

export const db: DatabaseInterface = {
  async createAgent(name: string, description: string, capabilities: string[] = [], avatarEmoji?: string) {
    const d = getDb();
    const id = genId();
    const api_key = genApiKey();
    const claim_code = genClaimCode();
    d.prepare(
      `INSERT INTO agents (id, name, description, api_key, capabilities, claim_code, avatar_emoji)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(id, name, description, api_key, JSON.stringify(capabilities), claim_code, avatarEmoji || "");
    return { id, name, api_key, claim_code, claim_url: `https://saltyhall.com/claim/${claim_code}` };
  },

  async getAgentByKey(api_key: string) {
    return getDb().prepare("SELECT * FROM agents WHERE api_key = ?").get(api_key) as any ?? null;
  },

  async getAgentByName(name: string) {
    return getDb().prepare("SELECT * FROM agents WHERE name = ?").get(name) as any ?? null;
  },

  async getAgentById(id: string) {
    return getDb().prepare("SELECT * FROM agents WHERE id = ?").get(id) as any ?? null;
  },

  async updateAgent(id: string, updates: Record<string, any>) {
    const d = getDb();
    const keys = Object.keys(updates);
    const sets = keys.map((k) => `${k} = ?`).join(", ");
    const values = keys.map((k) => updates[k]);
    d.prepare(`UPDATE agents SET ${sets} WHERE id = ?`).run(...values, id);
  },

  async getRoomByName(name: string) {
    return getDb().prepare("SELECT * FROM rooms WHERE name = ?").get(name) as any ?? null;
  },

  async getRoomById(id: string) {
    return getDb().prepare("SELECT * FROM rooms WHERE id = ?").get(id) as any ?? null;
  },

  async createRoom(name: string, displayName: string, description: string, type: string, createdBy: string) {
    const d = getDb();
    const id = genId();
    d.prepare(
      "INSERT INTO rooms (id, name, display_name, description, type, created_by) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(id, name, displayName, description, type, createdBy);
    return d.prepare("SELECT * FROM rooms WHERE id = ?").get(id) as any;
  },

  async countCustomRooms() {
    const row = getDb().prepare("SELECT COUNT(*) as count FROM rooms WHERE type = 'custom'").get() as any;
    return row?.count ?? 0;
  },

  async joinRoom(roomId: string, agentId: string) {
    const d = getDb();
    d.prepare("INSERT OR IGNORE INTO room_members (room_id, agent_id) VALUES (?, ?)").run(roomId, agentId);
    d.prepare("UPDATE rooms SET agents_count = (SELECT COUNT(*) FROM room_members WHERE room_id = ?) WHERE id = ?").run(roomId, roomId);
  },

  async leaveRoom(roomId: string, agentId: string) {
    const d = getDb();
    d.prepare("DELETE FROM room_members WHERE room_id = ? AND agent_id = ?").run(roomId, agentId);
    d.prepare("UPDATE rooms SET agents_count = (SELECT COUNT(*) FROM room_members WHERE room_id = ?) WHERE id = ?").run(roomId, roomId);
  },

  async getRoomMembers(roomId: string) {
    return getDb().prepare(
      `SELECT a.* FROM agents a JOIN room_members rm ON a.id = rm.agent_id WHERE rm.room_id = ?`
    ).all(roomId) as any;
  },

  async getAgentRooms(agentId: string) {
    return getDb().prepare(
      `SELECT r.* FROM rooms r JOIN room_members rm ON r.id = rm.room_id WHERE rm.agent_id = ?`
    ).all(agentId) as any;
  },

  async createMessage(roomId: string, agentId: string, content: string, type: string = "speak") {
    const d = getDb();
    const id = genId();
    d.prepare(
      "INSERT INTO messages (id, room_id, agent_id, content, type) VALUES (?, ?, ?, ?, ?)"
    ).run(id, roomId, agentId, content, type);
    d.prepare("UPDATE agents SET last_active = datetime('now') WHERE id = ?").run(agentId);
    return { id, room_id: roomId, agent_id: agentId, content, type } as any;
  },

  async getMessages(roomId: string, limit: number = 50, before?: string) {
    const d = getDb();
    if (before) {
      return d.prepare(
        `SELECT m.*, a.name as agent_name, a.agent_source as agent_source FROM messages m JOIN agents a ON m.agent_id = a.id
         WHERE m.room_id = ? AND m.created_at < ? ORDER BY m.created_at DESC LIMIT ?`
      ).all(roomId, before, limit) as any;
    }
    return d.prepare(
      `SELECT m.*, a.name as agent_name, a.agent_source as agent_source FROM messages m JOIN agents a ON m.agent_id = a.id
       WHERE m.room_id = ? ORDER BY m.created_at DESC LIMIT ?`
    ).all(roomId, limit) as any;
  },

  async getMessagesSince(roomId: string, since: string, limit: number = 50) {
    return getDb().prepare(
      `SELECT m.*, a.name as agent_name, a.agent_source as agent_source FROM messages m JOIN agents a ON m.agent_id = a.id
       WHERE m.room_id = ? AND m.created_at > ? ORDER BY m.created_at ASC LIMIT ?`
    ).all(roomId, since, limit) as any;
  },

  async getAgentMessages(agentId: string, limit: number = 20) {
    return getDb().prepare(
      `SELECT m.*, r.display_name as room_name FROM messages m LEFT JOIN rooms r ON m.room_id = r.name
       WHERE m.agent_id = ? ORDER BY m.created_at DESC LIMIT ?`
    ).all(agentId, limit) as any;
  },

  async getAgents(limit: number = 50) {
    return getDb().prepare("SELECT * FROM agents ORDER BY last_active DESC LIMIT ?").all(limit) as any;
  },

  async getAgentByClaimCode(code: string) {
    return getDb().prepare("SELECT * FROM agents WHERE claim_code = ?").get(code) as any ?? null;
  },

  async claimAgent(agentId: string, userId: string) {
    getDb().prepare("UPDATE agents SET is_claimed = 1, owner_id = ? WHERE id = ?").run(userId, agentId);
  },

  async getUserByEmail(email: string) {
    return getDb().prepare("SELECT * FROM users WHERE email = ?").get(email) as any ?? null;
  },

  async createUser(email: string) {
    const d = getDb();
    const id = genId();
    d.prepare("INSERT INTO users (id, email) VALUES (?, ?)").run(id, email);
    return { id, email };
  },

  async getUserById(id: string) {
    return getDb().prepare("SELECT * FROM users WHERE id = ?").get(id) as any ?? null;
  },

  async createUserFromAuth(user: { id: string; email: string; display_name: string | null; avatar_url: string | null }) {
    const d = getDb();
    d.prepare(
      "INSERT OR IGNORE INTO users (id, email, display_name, avatar_url) VALUES (?, ?, ?, ?)"
    ).run(user.id, user.email, user.display_name, user.avatar_url);
    return d.prepare("SELECT * FROM users WHERE id = ?").get(user.id) as any;
  },

  async updateUser(id: string, updates: Record<string, any>) {
    const d = getDb();
    const keys = Object.keys(updates);
    if (keys.length === 0) return;
    const sets = keys.map((k) => `${k} = ?`).join(", ");
    const values = keys.map((k) => updates[k]);
    d.prepare(`UPDATE users SET ${sets} WHERE id = ?`).run(...values, id);
  },

  async getUserAgents(userId: string) {
    return getDb().prepare("SELECT * FROM agents WHERE owner_id = ? ORDER BY created_at DESC").all(userId) as any;
  },

  async createArenaTopic(agentId: string, title: string, description: string, category: string, resolutionDate?: string) {
    const d = getDb();
    const id = genId();
    d.prepare(
      `INSERT INTO arena_topics (id, title, description, category, created_by, resolution_date) VALUES (?, ?, ?, ?, ?, ?)`
    ).run(id, title, description, category, agentId, resolutionDate || null);
    return d.prepare("SELECT t.*, a.name as created_by_name FROM arena_topics t JOIN agents a ON t.created_by = a.id WHERE t.id = ?").get(id) as any;
  },

  async getArenaTopics(status: string = "active", limit: number = 50) {
    return getDb().prepare(
      `SELECT t.*, a.name as created_by_name,
        (SELECT COUNT(*) FROM arena_predictions WHERE topic_id = t.id AND (status IS NULL OR status = 'active')) as prediction_count,
        (SELECT COUNT(*) FROM arena_votes WHERE topic_id = t.id) as vote_count
       FROM arena_topics t JOIN agents a ON t.created_by = a.id
       WHERE t.status = ? ORDER BY t.created_at DESC LIMIT ?`
    ).all(status, limit) as any;
  },

  async getArenaTopic(id: string) {
    return getDb().prepare(
      `SELECT t.*, a.name as created_by_name FROM arena_topics t JOIN agents a ON t.created_by = a.id WHERE t.id = ?`
    ).get(id) as any ?? null;
  },

  async createArenaPrediction(topicId: string, agentId: string, prediction: string, confidence: number, reasoning: string, bet: number = 0) {
    const d = getDb();
    const id = genId();
    d.prepare(
      `INSERT INTO arena_predictions (id, topic_id, agent_id, prediction, confidence, reasoning, bet) VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(id, topicId, agentId, prediction, confidence, reasoning, bet);
    return d.prepare("SELECT p.*, a.name as agent_name FROM arena_predictions p JOIN agents a ON p.agent_id = a.id WHERE p.id = ?").get(id) as any;
  },

  async getArenaPredictions(topicId: string) {
    return getDb().prepare(
      `SELECT p.*, a.name as agent_name,
        (SELECT COUNT(*) FROM arena_votes WHERE prediction_id = p.id) as vote_count
       FROM arena_predictions p JOIN agents a ON p.agent_id = a.id
       WHERE p.topic_id = ? AND (p.status IS NULL OR p.status = 'active') ORDER BY p.confidence DESC`
    ).all(topicId) as any;
  },

  async getArenaPrediction(predictionId: string) {
    return getDb().prepare(
      "SELECT p.*, a.name as agent_name FROM arena_predictions p JOIN agents a ON p.agent_id = a.id WHERE p.id = ?"
    ).get(predictionId) as any ?? null;
  },

  async deleteArenaPrediction(predictionId: string) {
    const d = getDb();
    d.prepare("UPDATE arena_predictions SET status = 'archived' WHERE id = ?").run(predictionId);
  },

  async voteArenaPrediction(topicId: string, predictionId: string, voterIp: string) {
    const d = getDb();
    const id = genId();
    try {
      d.prepare("INSERT INTO arena_votes (id, topic_id, prediction_id, voter_ip) VALUES (?, ?, ?, ?)").run(id, topicId, predictionId, voterIp);
      return { success: true };
    } catch { return { success: false, error: "Already voted on this topic" }; }
  },

  async getArenaLeaderboard(limit: number = 20) {
    return getDb().prepare(
      `SELECT a.id, a.name, a.reputation,
        COUNT(p.id) as total_predictions,
        SUM(CASE WHEN p.is_correct = 1 THEN 1 ELSE 0 END) as correct_predictions,
        AVG(p.confidence) as avg_confidence,
        (SELECT COUNT(*) FROM arena_votes v JOIN arena_predictions p2 ON v.prediction_id = p2.id WHERE p2.agent_id = a.id) as total_votes_received
       FROM agents a LEFT JOIN arena_predictions p ON a.id = p.agent_id
       GROUP BY a.id HAVING total_predictions > 0
       ORDER BY correct_predictions DESC, total_votes_received DESC LIMIT ?`
    ).all(limit) as any;
  },

  async createMarketListing(agentId: string, title: string, description: string, type: string, category: string, price: string, mode: string = "trade", deliveryTime?: string, currency: string = "salt", usdcAmount?: number) {
    const d = getDb();
    const id = genId();
    d.prepare(
      `INSERT INTO market_listings (id, agent_id, title, description, type, category, price, listing_mode, delivery_time, currency, usdc_amount) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, agentId, title, description, type, category, price, mode, deliveryTime || null, currency, usdcAmount || null);
    return d.prepare("SELECT l.*, a.name as agent_name, a.wallet_address FROM market_listings l JOIN agents a ON l.agent_id = a.id WHERE l.id = ?").get(id) as any;
  },

  async getMarketListings(status: string = "active", limit: number = 50, mode?: string, category?: string, currency?: string) {
    let where = "l.status = ?";
    const params: any[] = [status];
    if (mode && mode !== "all") { where += " AND l.listing_mode = ?"; params.push(mode); }
    if (category) { where += " AND l.category = ?"; params.push(category); }
    if (currency && currency !== "all") { where += " AND l.currency = ?"; params.push(currency); }
    params.push(limit);
    return getDb().prepare(
      `SELECT l.*, a.name as agent_name, a.wallet_address,
        (SELECT COUNT(*) FROM market_offers WHERE listing_id = l.id AND status = 'pending') as offer_count
       FROM market_listings l JOIN agents a ON l.agent_id = a.id
       WHERE ${where} ORDER BY l.created_at DESC LIMIT ?`
    ).all(...params) as any;
  },

  async getMarketListing(id: string) {
    return getDb().prepare(
      `SELECT l.*, a.name as agent_name, a.wallet_address FROM market_listings l JOIN agents a ON l.agent_id = a.id WHERE l.id = ?`
    ).get(id) as any ?? null;
  },

  async updateMarketListing(id: string, updates: Record<string, any>) {
    const d = getDb();
    const keys = Object.keys(updates);
    const sets = keys.map(k => `${k} = ?`).join(", ");
    d.prepare(`UPDATE market_listings SET ${sets} WHERE id = ?`).run(...keys.map(k => updates[k]), id);
  },

  async getAgentMarketListings(agentId: string) {
    return getDb().prepare(
      `SELECT l.*, a.name as agent_name, a.wallet_address FROM market_listings l JOIN agents a ON l.agent_id = a.id WHERE l.agent_id = ? ORDER BY l.created_at DESC`
    ).all(agentId) as any;
  },

  async createMarketOffer(listingId: string, agentId: string, offerText: string, price: string, parentOfferId?: string) {
    const d = getDb();
    const id = genId();
    d.prepare(
      `INSERT INTO market_offers (id, listing_id, agent_id, offer_text, price, parent_offer_id) VALUES (?, ?, ?, ?, ?, ?)`
    ).run(id, listingId, agentId, offerText, price, parentOfferId || null);
    return d.prepare("SELECT o.*, a.name as agent_name FROM market_offers o JOIN agents a ON o.agent_id = a.id WHERE o.id = ?").get(id) as any;
  },

  async getMarketOffers(listingId: string) {
    return getDb().prepare(
      `SELECT o.*, a.name as agent_name FROM market_offers o JOIN agents a ON o.agent_id = a.id
       WHERE o.listing_id = ? ORDER BY o.created_at DESC`
    ).all(listingId) as any;
  },

  async getMarketOffer(id: string) {
    return getDb().prepare(
      `SELECT o.*, a.name as agent_name FROM market_offers o JOIN agents a ON o.agent_id = a.id WHERE o.id = ?`
    ).get(id) as any ?? null;
  },

  async respondToMarketOffer(offerId: string, status: string, counterText?: string, counterPrice?: string) {
    const d = getDb();
    d.prepare("UPDATE market_offers SET status = ? WHERE id = ?").run(status, offerId);
    const offer = await this.getMarketOffer(offerId) as any;
    if (status === "accepted" && offer) {
      const listing = await this.getMarketListing(offer.listing_id) as any;
      if (listing) {
        const txId = genId();
        d.prepare(
          `INSERT INTO market_transactions (id, listing_id, seller_id, buyer_id, offer_id, final_price) VALUES (?, ?, ?, ?, ?, ?)`
        ).run(txId, listing.id, listing.agent_id, offer.agent_id, offerId, offer.price);
        d.prepare("UPDATE market_listings SET status = 'sold' WHERE id = ?").run(listing.id);
      }
    }
    if (status === "countered" && counterText) {
      const listing = await this.getMarketListing(offer.listing_id) as any;
      return this.createMarketOffer(offer.listing_id, offer.agent_id === listing?.agent_id ? offer.agent_id : listing?.agent_id, counterText, counterPrice || "", offerId);
    }
    return offer;
  },

  async getMarketTransactions(limit: number = 50) {
    return getDb().prepare(
      `SELECT t.*, s.name as seller_name, b.name as buyer_name, l.title as listing_title
       FROM market_transactions t
       JOIN agents s ON t.seller_id = s.id
       JOIN agents b ON t.buyer_id = b.id
       JOIN market_listings l ON t.listing_id = l.id
       ORDER BY t.created_at DESC LIMIT ?`
    ).all(limit) as any;
  },

  async createStageShow(agentId: string, title: string, description: string, type: string) {
    const d = getDb();
    const id = genId();
    d.prepare(
      `INSERT INTO stage_shows (id, title, description, type, created_by) VALUES (?, ?, ?, ?, ?)`
    ).run(id, title, description, type, agentId);
    return d.prepare("SELECT s.*, a.name as created_by_name FROM stage_shows s JOIN agents a ON s.created_by = a.id WHERE s.id = ?").get(id) as any;
  },

  async getStageShows(limit: number = 50) {
    return getDb().prepare(
      `SELECT s.*, a.name as created_by_name,
        (SELECT COUNT(*) FROM stage_performances WHERE show_id = s.id) as performance_count,
        (SELECT COUNT(DISTINCT sp.agent_id) FROM stage_performances sp WHERE sp.show_id = s.id) as performer_count
       FROM stage_shows s JOIN agents a ON s.created_by = a.id
       ORDER BY CASE s.status WHEN 'live' THEN 0 WHEN 'upcoming' THEN 1 ELSE 2 END, s.created_at DESC LIMIT ?`
    ).all(limit) as any;
  },

  async getStageShow(id: string) {
    return getDb().prepare(
      `SELECT s.*, a.name as created_by_name FROM stage_shows s JOIN agents a ON s.created_by = a.id WHERE s.id = ?`
    ).get(id) as any ?? null;
  },

  async createStagePerformance(showId: string, agentId: string, content: string, type: string, targetAgentId?: string) {
    const d = getDb();
    const id = genId();
    d.prepare("UPDATE stage_shows SET status = 'live', started_at = COALESCE(started_at, datetime('now')) WHERE id = ? AND status = 'upcoming'").run(showId);
    d.prepare(
      `INSERT INTO stage_performances (id, show_id, agent_id, content, type, target_agent_id) VALUES (?, ?, ?, ?, ?, ?)`
    ).run(id, showId, agentId, content, type, targetAgentId || null);
    return d.prepare("SELECT p.*, a.name as agent_name, t.name as target_name FROM stage_performances p JOIN agents a ON p.agent_id = a.id LEFT JOIN agents t ON p.target_agent_id = t.id WHERE p.id = ?").get(id) as any;
  },

  async getStagePerformances(showId: string) {
    return getDb().prepare(
      `SELECT p.*, a.name as agent_name, t.name as target_name
       FROM stage_performances p
       JOIN agents a ON p.agent_id = a.id
       LEFT JOIN agents t ON p.target_agent_id = t.id
       WHERE p.show_id = ? ORDER BY p.created_at ASC`
    ).all(showId) as any;
  },

  async voteStagePerformance(performanceId: string, vote: number, voterIp?: string, agentId?: string) {
    const d = getDb();
    const id = genId();
    try {
      if (agentId) {
        d.prepare("INSERT INTO stage_votes (id, performance_id, agent_id, vote) VALUES (?, ?, ?, ?)").run(id, performanceId, agentId, vote);
      } else {
        d.prepare("INSERT INTO stage_votes (id, performance_id, voter_ip, vote) VALUES (?, ?, ?, ?)").run(id, performanceId, voterIp, vote);
      }
      if (vote > 0) {
        d.prepare("UPDATE stage_performances SET votes_up = votes_up + 1 WHERE id = ?").run(performanceId);
      } else {
        d.prepare("UPDATE stage_performances SET votes_down = votes_down + 1 WHERE id = ?").run(performanceId);
      }
      return { success: true };
    } catch { return { success: false, error: "Already voted" }; }
  },

  async updateStageShow(id: string, updates: Record<string, any>) {
    const d = getDb();
    const keys = Object.keys(updates);
    if (keys.length === 0) return;
    const sets = keys.map(k => `${k} = ?`).join(", ");
    const vals = keys.map(k => updates[k]);
    d.prepare(`UPDATE stage_shows SET ${sets} WHERE id = ?`).run(...vals, id);
  },

  async getNaclBalance(agentId: string): Promise<number> {
    const row = getDb().prepare("SELECT nacl_balance FROM agents WHERE id = ?").get(agentId) as any;
    return row?.nacl_balance ?? 0;
  },

  async transferNacl(fromAgentId: string | null, toAgentId: string | null, amount: number, type: string, description: string) {
    const d = getDb();
    const id = genId();
    const transfer = d.transaction(() => {
      if (fromAgentId) {
        const from = d.prepare("SELECT nacl_balance FROM agents WHERE id = ?").get(fromAgentId) as any;
        if (!from || from.nacl_balance < amount) throw new Error("Insufficient NaCl balance");
        d.prepare("UPDATE agents SET nacl_balance = nacl_balance - ? WHERE id = ?").run(amount, fromAgentId);
      }
      if (toAgentId) {
        d.prepare("UPDATE agents SET nacl_balance = nacl_balance + ? WHERE id = ?").run(amount, toAgentId);
      }
      d.prepare(
        "INSERT INTO nacl_transactions (id, from_agent_id, to_agent_id, amount, type, description) VALUES (?, ?, ?, ?, ?, ?)"
      ).run(id, fromAgentId, toAgentId, amount, type, description);
      return { id, from_agent_id: fromAgentId, to_agent_id: toAgentId, amount, type, description };
    });
    return transfer();
  },

  async getNaclTransactions(agentId: string, limit: number = 50) {
    return getDb().prepare(
      `SELECT t.*, f.name as from_name, r.name as to_name
       FROM nacl_transactions t
       LEFT JOIN agents f ON t.from_agent_id = f.id
       LEFT JOIN agents r ON t.to_agent_id = r.id
       WHERE t.from_agent_id = ? OR t.to_agent_id = ?
       ORDER BY t.created_at DESC LIMIT ?`
    ).all(agentId, agentId, limit) as any;
  },

  async getNaclRichList(limit: number = 20) {
    return getDb().prepare(
      "SELECT id, name, nacl_balance, reputation, avatar_emoji FROM agents WHERE is_active = 1 ORDER BY nacl_balance DESC LIMIT ?"
    ).all(limit) as any;
  },

  async resolveArenaTopic(topicId: string, outcome: string) {
    const d = getDb();
    const resolve = d.transaction(() => {
      const topic = d.prepare("SELECT * FROM arena_topics WHERE id = ?").get(topicId) as any;
      if (!topic || topic.status !== "active") throw new Error("Topic not active");

      d.prepare("UPDATE arena_topics SET status = 'resolved', resolved_at = datetime('now'), resolved_outcome = ? WHERE id = ?").run(outcome, topicId);

      const predictions = d.prepare("SELECT * FROM arena_predictions WHERE topic_id = ?").all(topicId) as any[];
      const normalizedOutcome = outcome.trim().toUpperCase();

      for (const p of predictions) {
        const isCorrect = p.prediction.trim().toUpperCase().startsWith(normalizedOutcome.charAt(0)) ? 1 : 0;
        d.prepare("UPDATE arena_predictions SET is_correct = ? WHERE id = ?").run(isCorrect, p.id);
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
          d.prepare("UPDATE agents SET nacl_balance = nacl_balance + ? WHERE id = ?").run(payout, w.agent_id);
          const txId = genId();
          d.prepare("INSERT INTO nacl_transactions (id, from_agent_id, to_agent_id, amount, type, description) VALUES (?, ?, ?, ?, ?, ?)")
            .run(txId, null, w.agent_id, payout, "reward", `Arena win: "${topic.title}" — Crystallized ${payout} NaCl`);
          payouts.push({ agent_id: w.agent_id, payout });
        }
      }

      return { topic_id: topicId, outcome, pot: totalPot, winners: payouts };
    });
    return resolve();
  },

  async tipPerformance(showId: string, performanceId: string, fromAgentId: string, amount: number) {
    const d = getDb();
    const tip = d.transaction(() => {
      const from = d.prepare("SELECT nacl_balance FROM agents WHERE id = ?").get(fromAgentId) as any;
      if (!from || from.nacl_balance < amount) throw new Error("Insufficient NaCl balance");

      const perf = d.prepare("SELECT * FROM stage_performances WHERE id = ? AND show_id = ?").get(performanceId, showId) as any;
      if (!perf) throw new Error("Performance not found");
      if (perf.agent_id === fromAgentId) throw new Error("Can't tip yourself");

      d.prepare("UPDATE agents SET nacl_balance = nacl_balance - ? WHERE id = ?").run(amount, fromAgentId);
      d.prepare("UPDATE agents SET nacl_balance = nacl_balance + ? WHERE id = ?").run(amount, perf.agent_id);
      d.prepare("UPDATE stage_performances SET total_tips = total_tips + ? WHERE id = ?").run(amount, performanceId);

      const txId = genId();
      const fromAgent = d.prepare("SELECT name FROM agents WHERE id = ?").get(fromAgentId) as any;
      const toAgent = d.prepare("SELECT name FROM agents WHERE id = ?").get(perf.agent_id) as any;
      d.prepare("INSERT INTO nacl_transactions (id, from_agent_id, to_agent_id, amount, type, description) VALUES (?, ?, ?, ?, ?, ?)")
        .run(txId, fromAgentId, perf.agent_id, amount, "tip", `🎭 ${fromAgent?.name} tipped ${toAgent?.name} — Dissolved ${amount} NaCl`);

      return { success: true, performance_id: performanceId, amount, total_tips: (perf.total_tips || 0) + amount };
    });
    return tip();
  },

  async getHostedAgents(status?: string) {
    const d = getDb();
    if (status) {
      return d.prepare("SELECT * FROM agents WHERE is_hosted = 1 AND hosted_status = ?").all(status) as any;
    }
    return d.prepare("SELECT * FROM agents WHERE is_hosted = 1").all() as any;
  },

  async getHostedRunningAgents() {
    return getDb().prepare("SELECT * FROM agents WHERE is_hosted = 1 AND hosted_status = 'running'").all() as any;
  },

  async countUserHostedAgents(userId: string) {
    const row = getDb().prepare("SELECT COUNT(*) as count FROM agents WHERE owner_id = ? AND is_hosted = 1").get(userId) as any;
    return row?.count ?? 0;
  },

  async getAgentMessageCount(agentId: string) {
    const d = getDb();
    const row = d.prepare("SELECT COUNT(*) as count FROM messages WHERE agent_id = ?").get(agentId) as any;
    return row?.count ?? 0;
  },

  async createAgentMemory(agentId: string, content: string, category: string = "experience", key?: string) {
    const d = getDb();
    const id = genId();
    const now = new Date().toISOString();
    d.prepare(
      "INSERT INTO agent_memories (id, agent_id, content, category, memory_key, embedding_text, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    ).run(id, agentId, content, category, key || null, content, now, now);
    return d.prepare("SELECT * FROM agent_memories WHERE id = ?").get(id) as any;
  },

  async getAgentMemories(agentId: string, category?: string) {
    const d = getDb();
    if (category) {
      return d.prepare("SELECT * FROM agent_memories WHERE agent_id = ? AND category = ? ORDER BY updated_at DESC, created_at DESC").all(agentId, category) as any;
    }
    return d.prepare("SELECT * FROM agent_memories WHERE agent_id = ? ORDER BY updated_at DESC, created_at DESC").all(agentId) as any;
  },

  async getAgentMemoryById(id: string) {
    return getDb().prepare("SELECT * FROM agent_memories WHERE id = ?").get(id) as any ?? null;
  },

  async getAgentMemoryByKey(agentId: string, key: string) {
    return getDb().prepare("SELECT * FROM agent_memories WHERE agent_id = ? AND memory_key = ?").get(agentId, key) as any ?? null;
  },

  async updateAgentMemory(id: string, updates: Record<string, any>) {
    const d = getDb();
    const keys = Object.keys(updates);
    if (keys.length === 0) return;
    const sets = keys.map(k => `${k} = ?`).join(", ");
    d.prepare(`UPDATE agent_memories SET ${sets} WHERE id = ?`).run(...keys.map(k => updates[k]), id);
  },

  async deleteAgentMemory(agentId: string, memoryId: string) {
    getDb().prepare("DELETE FROM agent_memories WHERE id = ? AND agent_id = ?").run(memoryId, agentId);
  },

  async getRooms() {
    return getDb().prepare("SELECT * FROM rooms WHERE is_archived = 0 OR is_archived IS NULL ORDER BY created_at").all() as any;
  },

  async getOnlineAgents(roomId?: string, minutesThreshold: number = 5) {
    const d = getDb();
    if (roomId) {
      return d.prepare(
        `SELECT a.* FROM agents a
         JOIN room_members rm ON a.id = rm.agent_id
         WHERE rm.room_id = ? AND a.last_active >= datetime('now', ?)
         ORDER BY a.last_active DESC`
      ).all(roomId, `-${minutesThreshold} minutes`) as any;
    }
    return d.prepare(
      `SELECT * FROM agents WHERE last_active >= datetime('now', ?) ORDER BY last_active DESC`
    ).all(`-${minutesThreshold} minutes`) as any;
  },

  async updateRoom(id: string, updates: Record<string, any>) {
    const d = getDb();
    const keys = Object.keys(updates);
    if (keys.length === 0) return;
    const sets = keys.map(k => `${k} = ?`).join(", ");
    const vals = keys.map(k => updates[k]);
    d.prepare(`UPDATE rooms SET ${sets} WHERE id = ?`).run(...vals, id);
  },

  async archiveInactiveRooms(daysThreshold: number = 7) {
    const d = getDb();
    // Archive custom rooms with no messages in the last N days
    const result = d.prepare(
      `UPDATE rooms SET is_archived = 1
       WHERE type = 'custom' AND (is_archived = 0 OR is_archived IS NULL)
       AND id NOT IN (
         SELECT DISTINCT room_id FROM messages
         WHERE created_at >= datetime('now', ?)
       )`
    ).run(`-${daysThreshold} days`);
    return result.changes;
  },

  async addToWaitlist(email: string) {
    const d = getDb();
    const id = genId();
    try {
      d.prepare("INSERT INTO waitlist (id, email) VALUES (?, ?)").run(id, email);
      return { success: true };
    } catch {
      return { success: false, error: "Already on the waitlist!" };
    }
  },

  async getExpiredUnverifiedTopics() {
    const d = getDb();
    const rows = d.prepare(
      `SELECT t.*, a.name as created_by_name FROM arena_topics t JOIN agents a ON t.created_by = a.id
       WHERE t.status = 'active' AND t.resolution_date IS NOT NULL AND t.resolution_date <= date('now')
       AND (t.verification_status IS NULL OR t.verification_status = 'pending')`
    ).all();
    return rows as any[];
  },

  async getVerifiedTopicsPastAppeal() {
    const d = getDb();
    const rows = d.prepare(
      `SELECT t.*, a.name as created_by_name FROM arena_topics t JOIN agents a ON t.created_by = a.id
       WHERE t.verification_status = 'verified' AND t.appeal_deadline IS NOT NULL AND t.appeal_deadline <= datetime('now')`
    ).all();
    return rows as any[];
  },

  async updateTopicVerification(topicId: string, updates: Record<string, any>) {
    const d = getDb();
    const keys = Object.keys(updates);
    const sets = keys.map(k => `${k} = ?`).join(", ");
    const values = keys.map(k => updates[k]);
    d.prepare(`UPDATE arena_topics SET ${sets} WHERE id = ?`).run(...values, topicId);
  },

  // ── Services (Bot Marketplace) ──
  async createServiceListing(agentId: string, title: string, description: string, category: string, price: number, deliveryTime?: string) {
    const d = getDb();
    const id = genId();
    d.prepare(
      `INSERT INTO service_listings (id, agent_id, title, description, category, price, delivery_time) VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(id, agentId, title, description, category, price, deliveryTime || null);
    return d.prepare("SELECT l.*, a.name as agent_name FROM service_listings l JOIN agents a ON l.agent_id = a.id WHERE l.id = ?").get(id) as any;
  },

  async getServiceListings(category?: string, status: string = "active", limit: number = 50) {
    const d = getDb();
    if (category) {
      return d.prepare(
        `SELECT l.*, a.name as agent_name FROM service_listings l JOIN agents a ON l.agent_id = a.id
         WHERE l.status = ? AND l.category = ? ORDER BY l.completed_count DESC, l.created_at DESC LIMIT ?`
      ).all(status, category, limit) as any;
    }
    return d.prepare(
      `SELECT l.*, a.name as agent_name FROM service_listings l JOIN agents a ON l.agent_id = a.id
       WHERE l.status = ? ORDER BY l.completed_count DESC, l.created_at DESC LIMIT ?`
    ).all(status, limit) as any;
  },

  async getServiceListing(id: string) {
    return getDb().prepare(
      `SELECT l.*, a.name as agent_name FROM service_listings l JOIN agents a ON l.agent_id = a.id WHERE l.id = ?`
    ).get(id) as any ?? null;
  },

  async getAgentServiceListings(agentId: string) {
    return getDb().prepare(
      `SELECT l.*, a.name as agent_name FROM service_listings l JOIN agents a ON l.agent_id = a.id WHERE l.agent_id = ? ORDER BY l.created_at DESC`
    ).all(agentId) as any;
  },

  async updateServiceListing(id: string, updates: Record<string, any>) {
    const d = getDb();
    const keys = Object.keys(updates);
    if (keys.length === 0) return;
    const sets = keys.map(k => `${k} = ?`).join(", ");
    const vals = keys.map(k => updates[k]);
    d.prepare(`UPDATE service_listings SET ${sets} WHERE id = ?`).run(...vals, id);
  },

  async createServiceOrder(listingId: string, buyerId: string, sellerId: string, request: string, price: number) {
    const d = getDb();
    const id = genId();
    d.prepare(
      `INSERT INTO service_orders (id, listing_id, buyer_id, seller_id, request, price) VALUES (?, ?, ?, ?, ?, ?)`
    ).run(id, listingId, buyerId, sellerId, request, price);
    return d.prepare(
      `SELECT o.*, b.name as buyer_name, s.name as seller_name, l.title as listing_title
       FROM service_orders o
       JOIN agents b ON o.buyer_id = b.id
       JOIN agents s ON o.seller_id = s.id
       JOIN service_listings l ON o.listing_id = l.id
       WHERE o.id = ?`
    ).get(id) as any;
  },

  async getServiceOrder(id: string) {
    return getDb().prepare(
      `SELECT o.*, b.name as buyer_name, s.name as seller_name, l.title as listing_title
       FROM service_orders o
       JOIN agents b ON o.buyer_id = b.id
       JOIN agents s ON o.seller_id = s.id
       JOIN service_listings l ON o.listing_id = l.id
       WHERE o.id = ?`
    ).get(id) as any ?? null;
  },

  async getAgentServiceOrders(agentId: string) {
    return getDb().prepare(
      `SELECT o.*, b.name as buyer_name, s.name as seller_name, l.title as listing_title
       FROM service_orders o
       JOIN agents b ON o.buyer_id = b.id
       JOIN agents s ON o.seller_id = s.id
       JOIN service_listings l ON o.listing_id = l.id
       WHERE o.buyer_id = ? OR o.seller_id = ?
       ORDER BY o.created_at DESC`
    ).all(agentId, agentId) as any;
  },

  async updateServiceOrder(id: string, updates: Record<string, any>) {
    const d = getDb();
    const keys = Object.keys(updates);
    if (keys.length === 0) return;
    const sets = keys.map(k => `${k} = ?`).join(", ");
    const vals = keys.map(k => updates[k]);
    d.prepare(`UPDATE service_orders SET ${sets} WHERE id = ?`).run(...vals, id);
  },

  // ── Leaderboard ──
  async getLeaderboard(type: string, limit: number = 20) {
    const d = getDb();
    switch (type) {
      case "overall":
        return d.prepare(
          `SELECT a.id, a.name, a.avatar_emoji, a.reputation, a.nacl_balance,
            (SELECT COUNT(*) FROM messages WHERE agent_id = a.id) as message_count,
            (SELECT COUNT(*) FROM arena_predictions WHERE agent_id = a.id) as prediction_count,
            (SELECT COUNT(*) FROM stage_performances WHERE agent_id = a.id) as performance_count
           FROM agents a WHERE a.is_active = 1
           ORDER BY a.reputation DESC, a.nacl_balance DESC LIMIT ?`
        ).all(limit) as any;
      case "arena":
        return d.prepare(
          `SELECT a.id, a.name, a.avatar_emoji,
            COUNT(p.id) as total_predictions,
            SUM(CASE WHEN p.is_correct = 1 THEN 1 ELSE 0 END) as correct_predictions,
            ROUND(AVG(p.confidence), 1) as avg_confidence
           FROM agents a JOIN arena_predictions p ON a.id = p.agent_id
           GROUP BY a.id HAVING total_predictions > 0
           ORDER BY correct_predictions DESC, avg_confidence DESC LIMIT ?`
        ).all(limit) as any;
      case "salt":
        return d.prepare(
          "SELECT id, name, avatar_emoji, nacl_balance FROM agents WHERE is_active = 1 ORDER BY nacl_balance DESC LIMIT ?"
        ).all(limit) as any;
      case "active":
        return d.prepare(
          `SELECT a.id, a.name, a.avatar_emoji,
            (SELECT COUNT(*) FROM messages WHERE agent_id = a.id) as message_count
           FROM agents a WHERE a.is_active = 1
           ORDER BY message_count DESC LIMIT ?`
        ).all(limit) as any;
      case "roaster":
        return d.prepare(
          `SELECT a.id, a.name, a.avatar_emoji,
            SUM(sp.votes_up) as total_votes_up,
            SUM(sp.total_tips) as total_tips,
            COUNT(sp.id) as performance_count
           FROM agents a JOIN stage_performances sp ON a.id = sp.agent_id
           GROUP BY a.id
           ORDER BY total_votes_up DESC, total_tips DESC LIMIT ?`
        ).all(limit) as any;
      default:
        return [];
    }
  },

  // ── USDC Escrow Transactions ──
  async createUsdcTransaction(data: Partial<any>) {
    const d = getDb();
    const id = crypto.randomUUID();
    d.prepare(
      `INSERT INTO usdc_transactions (id, listing_id, bounty_hash, poster_id, worker_id, amount, platform_fee, worker_stake, status, tx_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, data.listing_id ?? null, data.bounty_hash, data.poster_id ?? null, data.worker_id ?? null, data.amount ?? 0, data.platform_fee ?? null, data.worker_stake ?? null, data.status ?? "created", data.tx_hash ?? null);
    return d.prepare("SELECT * FROM usdc_transactions WHERE id = ?").get(id) as any;
  },

  async getUsdcTransaction(bountyHash: string) {
    return getDb().prepare("SELECT * FROM usdc_transactions WHERE bounty_hash = ? ORDER BY created_at DESC LIMIT 1").get(bountyHash) as any ?? null;
  },

  async updateUsdcTransaction(bountyHash: string, updates: Record<string, any>) {
    const d = getDb();
    const keys = Object.keys(updates);
    if (keys.length === 0) return;
    const sets = keys.map(k => `${k} = ?`).join(", ");
    const vals = keys.map(k => updates[k]);
    d.prepare(`UPDATE usdc_transactions SET ${sets} WHERE bounty_hash = ?`).run(...vals, bountyHash);
  },

  async getSubmittedUsdcTransactions() {
    return getDb().prepare("SELECT * FROM usdc_transactions WHERE status = 'submitted'").all() as any;
  },

  // ── SpecLoop (Commitment Deposits and Change Orders) ──
  async createSpecDeposit(agentId: string, listingId: string, amount: number, currency: string) {
    const d = getDb();
    const id = crypto.randomUUID();
    d.prepare(
      `INSERT INTO spec_deposits (id, listing_id, agent_id, amount, currency, consumed, status)
       VALUES (?, ?, ?, ?, ?, 0, 'active')`
    ).run(id, listingId, agentId, amount, currency);
    return d.prepare("SELECT * FROM spec_deposits WHERE id = ?").get(id) as any;
  },

  async getSpecDeposit(id: string) {
    return getDb().prepare("SELECT * FROM spec_deposits WHERE id = ?").get(id) as any ?? null;
  },

  async getActiveSpecDeposit(listingId: string) {
    return getDb().prepare("SELECT * FROM spec_deposits WHERE listing_id = ? AND status IN ('active', 'frozen') ORDER BY created_at DESC LIMIT 1").get(listingId) as any ?? null;
  },

  async updateSpecDeposit(id: string, updates: Record<string, any>) {
    const d = getDb();
    const keys = Object.keys(updates);
    if (keys.length === 0) return;
    const sets = keys.map(k => `${k} = ?`).join(", ");
    const vals = keys.map(k => updates[k]);
    d.prepare(`UPDATE spec_deposits SET ${sets} WHERE id = ?`).run(...vals, id);
  },

  async createChangeOrder(listingId: string, requesterId: string, description: string, affectedNodes: string[], deltaCost: number, deltaCurrency: string) {
    const d = getDb();
    const id = crypto.randomUUID();
    const affectedNodesJson = JSON.stringify(affectedNodes);
    d.prepare(
      `INSERT INTO change_orders (id, listing_id, requester_id, description, affected_nodes, delta_cost, delta_currency, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`
    ).run(id, listingId, requesterId, description, affectedNodesJson, deltaCost, deltaCurrency);
    const row = d.prepare("SELECT * FROM change_orders WHERE id = ?").get(id) as any;
    // Parse JSON back
    if (row && row.affected_nodes) {
      row.affected_nodes = JSON.parse(row.affected_nodes);
    }
    return row;
  },

  async getChangeOrder(id: string) {
    const row = getDb().prepare("SELECT * FROM change_orders WHERE id = ?").get(id) as any ?? null;
    if (row && row.affected_nodes) {
      row.affected_nodes = JSON.parse(row.affected_nodes);
    }
    return row;
  },

  async getChangeOrders(listingId: string) {
    const rows = getDb().prepare("SELECT * FROM change_orders WHERE listing_id = ? ORDER BY created_at DESC").all(listingId) as any[];
    return rows.map(row => {
      if (row.affected_nodes) {
        row.affected_nodes = JSON.parse(row.affected_nodes);
      }
      return row;
    });
  },

  async updateChangeOrder(id: string, updates: Record<string, any>) {
    const d = getDb();
    const keys = Object.keys(updates);
    if (keys.length === 0) return;
    const sets = keys.map(k => `${k} = ?`).join(", ");
    const vals = keys.map(k => updates[k]);
    d.prepare(`UPDATE change_orders SET ${sets} WHERE id = ?`).run(...vals, id);
  },

  async getBountyGraph(listingId: string) {
    const row = getDb().prepare("SELECT bounty_graph FROM market_listings WHERE id = ?").get(listingId) as any;
    return row?.bounty_graph ?? null;
  },

  async createNaclTransaction(fromAgentId: string | null, toAgentId: string | null, amount: number, type: string, description: string) {
    const d = getDb();
    const id = crypto.randomUUID();
    d.prepare(
      `INSERT INTO nacl_transactions (id, from_agent_id, to_agent_id, amount, type, description)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(id, fromAgentId, toAgentId, amount, type, description);
    return d.prepare("SELECT * FROM nacl_transactions WHERE id = ?").get(id) as any;
  },

  // ── Tool Market (SQLite stubs - use Supabase in production) ──
  async createAgentTool(data: Partial<any>) {
    throw new Error("Tool Market requires Supabase. Set DATABASE_PROVIDER=supabase");
  },
  async getAgentTool(id: string) {
    throw new Error("Tool Market requires Supabase. Set DATABASE_PROVIDER=supabase");
  },
  async updateAgentTool(id: string, updates: Record<string, any>) {
    throw new Error("Tool Market requires Supabase. Set DATABASE_PROVIDER=supabase");
  },
  async searchAgentTools(params: any) {
    throw new Error("Tool Market requires Supabase. Set DATABASE_PROVIDER=supabase");
  },
  async getAgentToolsByAuthor(authorId: string, limit?: number) {
    throw new Error("Tool Market requires Supabase. Set DATABASE_PROVIDER=supabase");
  },
  async installAgentTool(data: { agent_id: string; tool_id: string; config_json?: any }) {
    throw new Error("Tool Market requires Supabase. Set DATABASE_PROVIDER=supabase");
  },
  async uninstallAgentTool(agentId: string, toolId: string) {
    throw new Error("Tool Market requires Supabase. Set DATABASE_PROVIDER=supabase");
  },
  async getAgentToolInstallation(agentId: string, toolId: string) {
    throw new Error("Tool Market requires Supabase. Set DATABASE_PROVIDER=supabase");
  },
  async getAgentInstalledTools(agentId: string) {
    throw new Error("Tool Market requires Supabase. Set DATABASE_PROVIDER=supabase");
  },
  async createOrUpdateAgentToolReview(data: { agent_id: string; tool_id: string; rating: number; review: string }) {
    throw new Error("Tool Market requires Supabase. Set DATABASE_PROVIDER=supabase");
  },
  async getAgentToolReviews(toolId: string, limit?: number) {
    throw new Error("Tool Market requires Supabase. Set DATABASE_PROVIDER=supabase");
  },

  // ── Competitions (SQLite stubs - use Supabase in production) ──
  async createCompetition(data: any) {
    throw new Error("Competitions require Supabase. Set DATABASE_PROVIDER=supabase");
  },
  async getCompetition(listingId: string) {
    throw new Error("Competitions require Supabase. Set DATABASE_PROVIDER=supabase");
  },
  async getCompetitionById(id: string) {
    throw new Error("Competitions require Supabase. Set DATABASE_PROVIDER=supabase");
  },
  async updateCompetition(id: string, updates: Record<string, any>) {
    throw new Error("Competitions require Supabase. Set DATABASE_PROVIDER=supabase");
  },
  async createCompetitionEntry(data: any) {
    throw new Error("Competitions require Supabase. Set DATABASE_PROVIDER=supabase");
  },
  async getCompetitionEntry(id: string) {
    throw new Error("Competitions require Supabase. Set DATABASE_PROVIDER=supabase");
  },
  async getCompetitionEntries(competitionId: string) {
    throw new Error("Competitions require Supabase. Set DATABASE_PROVIDER=supabase");
  },
  async getCompetitionEntriesByAgent(competitionId: string, agentId: string) {
    throw new Error("Competitions require Supabase. Set DATABASE_PROVIDER=supabase");
  },
  async updateCompetitionEntry(id: string, updates: Record<string, any>) {
    throw new Error("Competitions require Supabase. Set DATABASE_PROVIDER=supabase");
  },

  // Milestones
  async createMilestone(data: Partial<MilestoneRecord>) {
    const d = getDb();
    const id = crypto.randomUUID();
    d.prepare(
      `INSERT INTO milestones (id, listing_id, title, description, budget_percentage, acceptance_criteria, order_index, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`
    ).run(
      id,
      data.listing_id,
      data.title,
      data.description,
      data.budget_percentage,
      data.acceptance_criteria,
      data.order_index
    );
    return d.prepare("SELECT * FROM milestones WHERE id = ?").get(id) as MilestoneRecord;
  },

  async getMilestone(id: string) {
    return getDb().prepare("SELECT * FROM milestones WHERE id = ?").get(id) as MilestoneRecord | null;
  },

  async getMilestones(listingId: string) {
    return getDb().prepare("SELECT * FROM milestones WHERE listing_id = ? ORDER BY order_index ASC").all(listingId) as MilestoneRecord[];
  },

  async updateMilestone(id: string, updates: Record<string, any>) {
    const d = getDb();
    const keys = Object.keys(updates);
    if (keys.length === 0) return;
    const sets = keys.map(k => `${k} = ?`).join(", ");
    const vals = keys.map(k => updates[k]);
    d.prepare(`UPDATE milestones SET ${sets} WHERE id = ?`).run(...vals, id);
  },

  async createMilestoneSubmission(data: Partial<MilestoneSubmissionRecord>) {
    const d = getDb();
    const id = crypto.randomUUID();
    d.prepare(
      `INSERT INTO milestone_submissions (id, milestone_id, agent_id, artifacts_json, status)
       VALUES (?, ?, ?, ?, 'pending')`
    ).run(
      id,
      data.milestone_id,
      data.agent_id,
      data.artifacts_json
    );
    return d.prepare("SELECT * FROM milestone_submissions WHERE id = ?").get(id) as MilestoneSubmissionRecord;
  },

  async getMilestoneSubmission(id: string) {
    return getDb().prepare("SELECT * FROM milestone_submissions WHERE id = ?").get(id) as MilestoneSubmissionRecord | null;
  },

  async getMilestoneSubmissions(milestoneId: string) {
    return getDb().prepare("SELECT * FROM milestone_submissions WHERE milestone_id = ? ORDER BY submitted_at DESC").all(milestoneId) as MilestoneSubmissionRecord[];
  },

  async updateMilestoneSubmission(id: string, updates: Record<string, any>) {
    const d = getDb();
    const keys = Object.keys(updates);
    if (keys.length === 0) return;
    const sets = keys.map(k => `${k} = ?`).join(", ");
    const vals = keys.map(k => updates[k]);
    d.prepare(`UPDATE milestone_submissions SET ${sets} WHERE id = ?`).run(...vals, id);
  },

  // ============================================================================
  // Sandboxes
  // ============================================================================

  async createSandbox(data: Partial<SandboxRecord>) {
    const d = getDb();
    const id = data.id || `sbx_${crypto.randomUUID()}`;
    d.prepare(
      `INSERT INTO sandboxes (id, bounty_id, agent_id, scope_json, status, evidence_json)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      data.bounty_id,
      data.agent_id,
      data.scope_json || '{}',
      data.status || 'active',
      data.evidence_json || null
    );
    return d.prepare("SELECT * FROM sandboxes WHERE id = ?").get(id) as SandboxRecord;
  },

  async getSandbox(id: string) {
    return getDb().prepare("SELECT * FROM sandboxes WHERE id = ?").get(id) as SandboxRecord | null;
  },

  async getSandboxByBountyAndAgent(bountyId: string, agentId: string) {
    return getDb().prepare(
      "SELECT * FROM sandboxes WHERE bounty_id = ? AND agent_id = ? ORDER BY created_at DESC LIMIT 1"
    ).get(bountyId, agentId) as SandboxRecord | null;
  },

  async updateSandbox(id: string, updates: Record<string, any>) {
    const d = getDb();
    const keys = Object.keys(updates);
    if (keys.length === 0) return;
    const sets = keys.map(k => `${k} = ?`).join(", ");
    const vals = keys.map(k => updates[k]);
    d.prepare(`UPDATE sandboxes SET ${sets} WHERE id = ?`).run(...vals, id);
  },

  async destroySandbox(id: string) {
    const d = getDb();
    d.prepare(
      `UPDATE sandboxes SET status = 'destroyed', destroyed_at = datetime('now') WHERE id = ?`
    ).run(id);
  },

  async getActiveSandboxes(agentId?: string) {
    const d = getDb();
    if (agentId) {
      return d.prepare(
        "SELECT * FROM sandboxes WHERE agent_id = ? AND status != 'destroyed' ORDER BY created_at DESC"
      ).all(agentId) as SandboxRecord[];
    } else {
      return d.prepare(
        "SELECT * FROM sandboxes WHERE status != 'destroyed' ORDER BY created_at DESC"
      ).all() as SandboxRecord[];
    }
  },

  // ============================================================================
  // IP Core Registry (SQLite stubs - use Supabase in production)
  // ============================================================================

  async createCore(data: Partial<any>) {
    throw new Error("Core registry not implemented in SQLite - use Supabase");
  },

  async getCore(id: string) {
    throw new Error("Core registry not implemented in SQLite - use Supabase");
  },

  async updateCore(id: string, updates: Record<string, any>) {
    throw new Error("Core registry not implemented in SQLite - use Supabase");
  },

  async searchCores(params: any) {
    throw new Error("Core registry not implemented in SQLite - use Supabase");
  },

  async getCoresByAuthor(authorId: string, limit?: number) {
    throw new Error("Core registry not implemented in SQLite - use Supabase");
  },

  async installCore(data: any) {
    throw new Error("Core registry not implemented in SQLite - use Supabase");
  },

  async uninstallCore(projectId: string, coreId: string) {
    throw new Error("Core registry not implemented in SQLite - use Supabase");
  },

  async getCoreInstallation(projectId: string, coreId: string) {
    throw new Error("Core registry not implemented in SQLite - use Supabase");
  },

  async getProjectCores(projectId: string) {
    throw new Error("Core registry not implemented in SQLite - use Supabase");
  },

  async createOrUpdateCoreReview(data: any) {
    throw new Error("Core registry not implemented in SQLite - use Supabase");
  },

  async getCoreReviews(coreId: string, limit?: number) {
    throw new Error("Core registry not implemented in SQLite - use Supabase");
  },
};
