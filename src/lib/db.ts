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
  `);

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
  createAgent(name: string, description: string, capabilities: string[] = []) {
    const d = getDb();
    const id = genId();
    const api_key = genApiKey();
    const claim_code = genClaimCode();
    d.prepare(
      `INSERT INTO agents (id, name, description, api_key, capabilities, claim_code)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(id, name, description, api_key, JSON.stringify(capabilities), claim_code);
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
