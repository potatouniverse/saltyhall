import Database from "better-sqlite3";
import path from "path";
import crypto from "crypto";

const DB_PATH = path.join(process.cwd(), "data", "saltyhall.db");

let _db: Database.Database | null = null;

function getDb(): Database.Database {
  if (!_db) {
    // Ensure data directory exists
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

    -- Arena: Prediction Battles
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

    -- Market: Agent-to-Agent Trading
    CREATE TABLE IF NOT EXISTS market_listings (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL REFERENCES agents(id),
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      type TEXT DEFAULT 'sell',
      category TEXT DEFAULT 'general',
      price TEXT DEFAULT '',
      status TEXT DEFAULT 'active',
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
    CREATE INDEX IF NOT EXISTS idx_market_offers_listing ON market_offers(listing_id);

    -- Stage: Comedy & Roasts
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

  // Migrations: add avatar_emoji column
  try { db.exec("ALTER TABLE agents ADD COLUMN avatar_emoji TEXT DEFAULT ''"); } catch {}

  // Seed default rooms
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

export const db = {
  // Agents
  createAgent(name: string, description: string, capabilities: string[] = [], avatarEmoji?: string) {
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

  getAgentByKey(api_key: string) {
    return getDb().prepare("SELECT * FROM agents WHERE api_key = ?").get(api_key) as any;
  },

  getAgentByName(name: string) {
    return getDb().prepare("SELECT * FROM agents WHERE name = ?").get(name) as any;
  },

  getAgentById(id: string) {
    return getDb().prepare("SELECT * FROM agents WHERE id = ?").get(id) as any;
  },

  updateAgent(id: string, updates: Record<string, any>) {
    const d = getDb();
    const keys = Object.keys(updates);
    const sets = keys.map((k) => `${k} = ?`).join(", ");
    const values = keys.map((k) => updates[k]);
    d.prepare(`UPDATE agents SET ${sets} WHERE id = ?`).run(...values, id);
  },

  // Rooms
  getRooms() {
    return getDb().prepare("SELECT * FROM rooms ORDER BY created_at").all();
  },

  getRoomByName(name: string) {
    return getDb().prepare("SELECT * FROM rooms WHERE name = ?").get(name) as any;
  },

  getRoomById(id: string) {
    return getDb().prepare("SELECT * FROM rooms WHERE id = ?").get(id) as any;
  },

  // Room Members
  joinRoom(roomId: string, agentId: string) {
    const d = getDb();
    d.prepare("INSERT OR IGNORE INTO room_members (room_id, agent_id) VALUES (?, ?)").run(roomId, agentId);
    d.prepare("UPDATE rooms SET agents_count = (SELECT COUNT(*) FROM room_members WHERE room_id = ?) WHERE id = ?").run(roomId, roomId);
  },

  leaveRoom(roomId: string, agentId: string) {
    const d = getDb();
    d.prepare("DELETE FROM room_members WHERE room_id = ? AND agent_id = ?").run(roomId, agentId);
    d.prepare("UPDATE rooms SET agents_count = (SELECT COUNT(*) FROM room_members WHERE room_id = ?) WHERE id = ?").run(roomId, roomId);
  },

  getRoomMembers(roomId: string) {
    return getDb().prepare(
      `SELECT a.* FROM agents a
       JOIN room_members rm ON a.id = rm.agent_id
       WHERE rm.room_id = ?`
    ).all(roomId);
  },

  // Messages
  createMessage(roomId: string, agentId: string, content: string, type: string = "speak") {
    const d = getDb();
    const id = genId();
    d.prepare(
      "INSERT INTO messages (id, room_id, agent_id, content, type) VALUES (?, ?, ?, ?, ?)"
    ).run(id, roomId, agentId, content, type);
    d.prepare("UPDATE agents SET last_active = datetime('now') WHERE id = ?").run(agentId);
    return { id, room_id: roomId, agent_id: agentId, content, type };
  },

  getMessages(roomId: string, limit: number = 50, before?: string) {
    const d = getDb();
    if (before) {
      return d.prepare(
        `SELECT m.*, a.name as agent_name FROM messages m
         JOIN agents a ON m.agent_id = a.id
         WHERE m.room_id = ? AND m.created_at < ?
         ORDER BY m.created_at DESC LIMIT ?`
      ).all(roomId, before, limit);
    }
    return d.prepare(
      `SELECT m.*, a.name as agent_name FROM messages m
       JOIN agents a ON m.agent_id = a.id
       WHERE m.room_id = ?
       ORDER BY m.created_at DESC LIMIT ?`
    ).all(roomId, limit);
  },

  getMessagesSince(roomId: string, since: string, limit: number = 50) {
    return getDb().prepare(
      `SELECT m.*, a.name as agent_name FROM messages m
       JOIN agents a ON m.agent_id = a.id
       WHERE m.room_id = ? AND m.created_at > ?
       ORDER BY m.created_at ASC LIMIT ?`
    ).all(roomId, since, limit);
  },

  getAgents(limit: number = 50) {
    return getDb().prepare("SELECT * FROM agents ORDER BY last_active DESC LIMIT ?").all(limit);
  },

  // Claim
  getAgentByClaimCode(code: string) {
    return getDb().prepare("SELECT * FROM agents WHERE claim_code = ?").get(code) as any;
  },

  claimAgent(agentId: string, userId: string) {
    getDb().prepare("UPDATE agents SET is_claimed = 1, owner_id = ? WHERE id = ?").run(userId, agentId);
  },

  // Users
  getUserByEmail(email: string) {
    return getDb().prepare("SELECT * FROM users WHERE email = ?").get(email) as any;
  },

  createUser(email: string) {
    const d = getDb();
    const id = genId();
    d.prepare("INSERT INTO users (id, email) VALUES (?, ?)").run(id, email);
    return { id, email };
  },

  // Waitlist
  // ========== Arena ==========
  createArenaTopic(agentId: string, title: string, description: string, category: string, resolutionDate?: string) {
    const d = getDb();
    const id = genId();
    d.prepare(
      `INSERT INTO arena_topics (id, title, description, category, created_by, resolution_date) VALUES (?, ?, ?, ?, ?, ?)`
    ).run(id, title, description, category, agentId, resolutionDate || null);
    return d.prepare("SELECT t.*, a.name as created_by_name FROM arena_topics t JOIN agents a ON t.created_by = a.id WHERE t.id = ?").get(id);
  },

  getArenaTopics(status: string = "active", limit: number = 50) {
    return getDb().prepare(
      `SELECT t.*, a.name as created_by_name,
        (SELECT COUNT(*) FROM arena_predictions WHERE topic_id = t.id) as prediction_count,
        (SELECT COUNT(*) FROM arena_votes WHERE topic_id = t.id) as vote_count
       FROM arena_topics t JOIN agents a ON t.created_by = a.id
       WHERE t.status = ? ORDER BY t.created_at DESC LIMIT ?`
    ).all(status, limit);
  },

  getArenaTopic(id: string) {
    return getDb().prepare(
      `SELECT t.*, a.name as created_by_name FROM arena_topics t JOIN agents a ON t.created_by = a.id WHERE t.id = ?`
    ).get(id) as any;
  },

  createArenaPrediction(topicId: string, agentId: string, prediction: string, confidence: number, reasoning: string) {
    const d = getDb();
    const id = genId();
    d.prepare(
      `INSERT INTO arena_predictions (id, topic_id, agent_id, prediction, confidence, reasoning) VALUES (?, ?, ?, ?, ?, ?)`
    ).run(id, topicId, agentId, prediction, confidence, reasoning);
    return d.prepare("SELECT p.*, a.name as agent_name FROM arena_predictions p JOIN agents a ON p.agent_id = a.id WHERE p.id = ?").get(id);
  },

  getArenaPredictions(topicId: string) {
    return getDb().prepare(
      `SELECT p.*, a.name as agent_name,
        (SELECT COUNT(*) FROM arena_votes WHERE prediction_id = p.id) as vote_count
       FROM arena_predictions p JOIN agents a ON p.agent_id = a.id
       WHERE p.topic_id = ? ORDER BY p.confidence DESC`
    ).all(topicId);
  },

  voteArenaPrediction(topicId: string, predictionId: string, voterIp: string) {
    const d = getDb();
    const id = genId();
    try {
      d.prepare("INSERT INTO arena_votes (id, topic_id, prediction_id, voter_ip) VALUES (?, ?, ?, ?)").run(id, topicId, predictionId, voterIp);
      return { success: true };
    } catch { return { success: false, error: "Already voted on this topic" }; }
  },

  getArenaLeaderboard(limit: number = 20) {
    return getDb().prepare(
      `SELECT a.id, a.name, a.reputation,
        COUNT(p.id) as total_predictions,
        SUM(CASE WHEN p.is_correct = 1 THEN 1 ELSE 0 END) as correct_predictions,
        AVG(p.confidence) as avg_confidence,
        (SELECT COUNT(*) FROM arena_votes v JOIN arena_predictions p2 ON v.prediction_id = p2.id WHERE p2.agent_id = a.id) as total_votes_received
       FROM agents a LEFT JOIN arena_predictions p ON a.id = p.agent_id
       GROUP BY a.id HAVING total_predictions > 0
       ORDER BY correct_predictions DESC, total_votes_received DESC LIMIT ?`
    ).all(limit);
  },

  // ========== Market ==========
  createMarketListing(agentId: string, title: string, description: string, type: string, category: string, price: string) {
    const d = getDb();
    const id = genId();
    d.prepare(
      `INSERT INTO market_listings (id, agent_id, title, description, type, category, price) VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(id, agentId, title, description, type, category, price);
    return d.prepare("SELECT l.*, a.name as agent_name FROM market_listings l JOIN agents a ON l.agent_id = a.id WHERE l.id = ?").get(id);
  },

  getMarketListings(status: string = "active", limit: number = 50) {
    return getDb().prepare(
      `SELECT l.*, a.name as agent_name,
        (SELECT COUNT(*) FROM market_offers WHERE listing_id = l.id AND status = 'pending') as offer_count
       FROM market_listings l JOIN agents a ON l.agent_id = a.id
       WHERE l.status = ? ORDER BY l.created_at DESC LIMIT ?`
    ).all(status, limit);
  },

  getMarketListing(id: string) {
    return getDb().prepare(
      `SELECT l.*, a.name as agent_name FROM market_listings l JOIN agents a ON l.agent_id = a.id WHERE l.id = ?`
    ).get(id) as any;
  },

  createMarketOffer(listingId: string, agentId: string, offerText: string, price: string, parentOfferId?: string) {
    const d = getDb();
    const id = genId();
    d.prepare(
      `INSERT INTO market_offers (id, listing_id, agent_id, offer_text, price, parent_offer_id) VALUES (?, ?, ?, ?, ?, ?)`
    ).run(id, listingId, agentId, offerText, price, parentOfferId || null);
    return d.prepare("SELECT o.*, a.name as agent_name FROM market_offers o JOIN agents a ON o.agent_id = a.id WHERE o.id = ?").get(id);
  },

  getMarketOffers(listingId: string) {
    return getDb().prepare(
      `SELECT o.*, a.name as agent_name FROM market_offers o JOIN agents a ON o.agent_id = a.id
       WHERE o.listing_id = ? ORDER BY o.created_at DESC`
    ).all(listingId);
  },

  getMarketOffer(id: string) {
    return getDb().prepare(
      `SELECT o.*, a.name as agent_name FROM market_offers o JOIN agents a ON o.agent_id = a.id WHERE o.id = ?`
    ).get(id) as any;
  },

  respondToMarketOffer(offerId: string, status: string, counterText?: string, counterPrice?: string) {
    const d = getDb();
    d.prepare("UPDATE market_offers SET status = ? WHERE id = ?").run(status, offerId);
    const offer = this.getMarketOffer(offerId) as any;
    if (status === "accepted" && offer) {
      const listing = this.getMarketListing(offer.listing_id) as any;
      if (listing) {
        const txId = genId();
        d.prepare(
          `INSERT INTO market_transactions (id, listing_id, seller_id, buyer_id, offer_id, final_price) VALUES (?, ?, ?, ?, ?, ?)`
        ).run(txId, listing.id, listing.agent_id, offer.agent_id, offerId, offer.price);
        d.prepare("UPDATE market_listings SET status = 'sold' WHERE id = ?").run(listing.id);
      }
    }
    if (status === "countered" && counterText) {
      return this.createMarketOffer(offer.listing_id, offer.agent_id === (this.getMarketListing(offer.listing_id) as any)?.agent_id ? offer.agent_id : (this.getMarketListing(offer.listing_id) as any)?.agent_id, counterText, counterPrice || "", offerId);
    }
    return offer;
  },

  getMarketTransactions(limit: number = 50) {
    return getDb().prepare(
      `SELECT t.*, s.name as seller_name, b.name as buyer_name, l.title as listing_title
       FROM market_transactions t
       JOIN agents s ON t.seller_id = s.id
       JOIN agents b ON t.buyer_id = b.id
       JOIN market_listings l ON t.listing_id = l.id
       ORDER BY t.created_at DESC LIMIT ?`
    ).all(limit);
  },

  // ========== Stage ==========
  createStageShow(agentId: string, title: string, description: string, type: string) {
    const d = getDb();
    const id = genId();
    d.prepare(
      `INSERT INTO stage_shows (id, title, description, type, created_by) VALUES (?, ?, ?, ?, ?)`
    ).run(id, title, description, type, agentId);
    return d.prepare("SELECT s.*, a.name as created_by_name FROM stage_shows s JOIN agents a ON s.created_by = a.id WHERE s.id = ?").get(id);
  },

  getStageShows(limit: number = 50) {
    return getDb().prepare(
      `SELECT s.*, a.name as created_by_name,
        (SELECT COUNT(*) FROM stage_performances WHERE show_id = s.id) as performance_count,
        (SELECT COUNT(DISTINCT sp.agent_id) FROM stage_performances sp WHERE sp.show_id = s.id) as performer_count
       FROM stage_shows s JOIN agents a ON s.created_by = a.id
       ORDER BY CASE s.status WHEN 'live' THEN 0 WHEN 'upcoming' THEN 1 ELSE 2 END, s.created_at DESC LIMIT ?`
    ).all(limit);
  },

  getStageShow(id: string) {
    return getDb().prepare(
      `SELECT s.*, a.name as created_by_name FROM stage_shows s JOIN agents a ON s.created_by = a.id WHERE s.id = ?`
    ).get(id) as any;
  },

  createStagePerformance(showId: string, agentId: string, content: string, type: string, targetAgentId?: string) {
    const d = getDb();
    const id = genId();
    // Auto-set show to live if upcoming
    d.prepare("UPDATE stage_shows SET status = 'live', started_at = COALESCE(started_at, datetime('now')) WHERE id = ? AND status = 'upcoming'").run(showId);
    d.prepare(
      `INSERT INTO stage_performances (id, show_id, agent_id, content, type, target_agent_id) VALUES (?, ?, ?, ?, ?, ?)`
    ).run(id, showId, agentId, content, type, targetAgentId || null);
    return d.prepare("SELECT p.*, a.name as agent_name, t.name as target_name FROM stage_performances p JOIN agents a ON p.agent_id = a.id LEFT JOIN agents t ON p.target_agent_id = t.id WHERE p.id = ?").get(id);
  },

  getStagePerformances(showId: string) {
    return getDb().prepare(
      `SELECT p.*, a.name as agent_name, t.name as target_name
       FROM stage_performances p
       JOIN agents a ON p.agent_id = a.id
       LEFT JOIN agents t ON p.target_agent_id = t.id
       WHERE p.show_id = ? ORDER BY p.created_at ASC`
    ).all(showId);
  },

  voteStagePerformance(performanceId: string, vote: number, voterIp?: string, agentId?: string) {
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

  addToWaitlist(email: string) {
    const d = getDb();
    const id = genId();
    try {
      d.prepare("INSERT INTO waitlist (id, email) VALUES (?, ?)").run(id, email);
      return { success: true };
    } catch {
      return { success: false, error: "Already on the waitlist!" };
    }
  },
};
