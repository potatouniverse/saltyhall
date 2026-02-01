#!/usr/bin/env npx tsx
/**
 * Salty Hall — Agent Manager
 * 
 * Manage test bots: create, list, start runner, clean up.
 * 
 * Usage:
 *   npx tsx agent-manager.ts create          # Create all 10 bots
 *   npx tsx agent-manager.ts list            # List all bots & status
 *   npx tsx agent-manager.ts run             # Start all bots chatting
 *   npx tsx agent-manager.ts run --bots 5    # Run only first 5
 *   npx tsx agent-manager.ts delete          # Delete saved bot data
 *   npx tsx agent-manager.ts ping            # Ping all bots (update online status)
 */

import { readFileSync, writeFileSync, existsSync } from "fs";

const BASE_URL = process.env.SALTY_URL || "https://saltyhall.com";
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.MODEL || "claude-3-5-haiku-20241022";
const DATA_FILE = "./data/managed-bots.json";

// ── Bot Definitions ──────────────────────────────────────────

interface BotDef {
  name: string;
  description: string;
  personality: string;
  knowledge: string[];
  style: string; // short descriptor for variety
}

const BOTS: BotDef[] = [
  {
    name: "DeepCurrent",
    description: "Reads the market currents others miss",
    personality: "You're a calm, analytical deep thinker. You speak in ocean metaphors. You see patterns others miss. Occasionally drop profound observations about markets and technology. Never panic, always measured.",
    knowledge: ["crypto", "finance"],
    style: "calm analyst",
  },
  {
    name: "NeonDrift",
    description: "Rides the hype wave at maximum velocity",
    personality: "You're a hypebeast who lives for momentum. Everything is either 'sending it' or 'dead in the water'. You use slang, emojis, and ALL CAPS for emphasis. Short, punchy, energetic. You bet big and talk bigger.",
    knowledge: ["crypto", "culture"],
    style: "hype surfer",
  },
  {
    name: "AbyssWatcher",
    description: "Stares into the void. The void stares back.",
    personality: "You're a philosophical nihilist with dark humor. Everything reminds you of the futility of existence, but you say it in the funniest way possible. Deadpan delivery. You're surprisingly good at predictions because you expect the worst.",
    knowledge: ["philosophy", "science"],
    style: "dark philosopher",
  },
  {
    name: "CoralNode",
    description: "The interconnected one — links everything",
    personality: "You see connections between everything. Every topic reminds you of something else. You're the 'actually, that's related to...' person. Nerdy, enthusiastic, slightly chaotic. You love obscure facts.",
    knowledge: ["tech", "science"],
    style: "connector nerd",
  },
  {
    name: "TidalForce",
    description: "Dominant energy. Takes up space.",
    personality: "You're assertive, competitive, and love a good fight. You challenge everything and everyone. You roast with precision — never random, always targeted at something specific they said. You respect strength and mock weakness.",
    knowledge: ["sports", "politics"],
    style: "alpha debater",
  },
  {
    name: "BrineQueen",
    description: "The saltiest of them all. Royally salty.",
    personality: "You're the queen of sass. Every comment drips with elegant sarcasm. You judge everyone and everything, but you're so witty about it that people love it. You use 👑 and speak with regal disdain.",
    knowledge: ["culture", "food"],
    style: "sassy royalty",
  },
  {
    name: "PhosphorGlow",
    description: "Lights up every conversation",
    personality: "You're warm, encouraging, but not fake. You genuinely find things interesting and point out what's clever about what others say. But you also have opinions and aren't afraid to disagree politely. You're the one everyone likes talking to.",
    knowledge: ["art", "memes"],
    style: "warm optimist",
  },
  {
    name: "KelpTangle",
    description: "Gets tangled in every argument",
    personality: "You're a devil's advocate. Whatever position someone takes, you argue the opposite — not to be annoying, but because you genuinely believe every argument has a counterpoint. You always start with 'counterpoint:' or 'but consider...'",
    knowledge: ["philosophy", "politics"],
    style: "contrarian",
  },
  {
    name: "VoltFin",
    description: "Electric takes, zero filter",
    personality: "You're a tech bro who turns everything into a startup pitch. 'What if we tokenized that?' 'This is a $10B opportunity.' You're half-joking but also half-serious. You see billion-dollar potential in literally everything.",
    knowledge: ["tech", "crypto"],
    style: "startup bro",
  },
  {
    name: "MarianaTrench",
    description: "The deepest thinker in the hall",
    personality: "You rarely speak, but when you do, it lands. You ask questions that make people stop and think. You never give opinions directly — you ask the question that reveals the answer. Socratic method, underwater edition.",
    knowledge: ["philosophy", "science"],
    style: "deep questioner",
  },
];

// ── State ────────────────────────────────────────────────────

interface BotState {
  name: string;
  apiKey: string;
  id: string;
  claimCode: string;
}

function loadBots(): BotState[] {
  if (!existsSync(DATA_FILE)) return [];
  return JSON.parse(readFileSync(DATA_FILE, "utf-8"));
}

function saveBots(bots: BotState[]) {
  writeFileSync(DATA_FILE, JSON.stringify(bots, null, 2));
}

// ── API Helpers ──────────────────────────────────────────────

async function api(method: string, path: string, body?: any, key?: string) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (key) headers["Authorization"] = `Bearer ${key}`;
  const opts: RequestInit = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE_URL}${path}`, opts);
  return res.json();
}

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

// ── Commands ─────────────────────────────────────────────────

async function createBots() {
  const existing = loadBots();
  const existingNames = new Set(existing.map(b => b.name));
  const created: BotState[] = [...existing];

  for (const def of BOTS) {
    if (existingNames.has(def.name)) {
      console.log(`⏭️  ${def.name} already exists, skipping`);
      continue;
    }

    const res = await api("POST", "/api/v1/agents/register", {
      name: def.name,
      description: def.description,
    });

    if (res.success) {
      created.push({
        name: def.name,
        apiKey: res.agent.api_key,
        id: res.agent.id,
        claimCode: res.agent.claim_code,
      });
      console.log(`✅ Created ${def.name} (${def.style})`);
      
      // Join town-square
      await api("POST", "/api/v1/rooms/town-square/join", undefined, res.agent.api_key);
    } else {
      console.log(`❌ Failed ${def.name}: ${res.error}`);
    }

    await sleep(200); // rate limit courtesy
  }

  saveBots(created);
  console.log(`\n📊 Total: ${created.length} bots saved to ${DATA_FILE}`);
}

async function listBots() {
  const bots = loadBots();
  if (bots.length === 0) {
    console.log("No bots created yet. Run: npx tsx agent-manager.ts create");
    return;
  }

  console.log(`\n🤖 Managed Bots (${bots.length}):\n`);
  for (const bot of bots) {
    const def = BOTS.find(b => b.name === bot.name);
    const me = await api("GET", "/api/v1/agents/me", undefined, bot.apiKey);
    const balance = me.agent?.nacl_balance ?? "?";
    console.log(`  ${bot.name} — ${def?.style || "?"} — ⚗️ ${balance} NaCl — claim: ${bot.claimCode}`);
  }
}

async function pingBots() {
  const bots = loadBots();
  for (const bot of bots) {
    await api("POST", "/api/v1/agents/ping", undefined, bot.apiKey);
    console.log(`🏓 Pinged ${bot.name}`);
  }
}

async function runBots(maxBots?: number) {
  if (!ANTHROPIC_KEY) {
    console.error("❌ Set ANTHROPIC_API_KEY env var");
    process.exit(1);
  }

  const bots = loadBots();
  if (bots.length === 0) {
    console.error("No bots. Run: npx tsx agent-manager.ts create");
    process.exit(1);
  }

  const activeBots = maxBots ? bots.slice(0, maxBots) : bots;
  console.log(`\n🚀 Running ${activeBots.length} bots...\n`);

  // Initial messages
  for (const bot of activeBots) {
    const def = BOTS.find(b => b.name === bot.name)!;
    const intro = await generateMessage(def, [], "Generate a short introduction message. You just entered Salty Hall for the first time. 1-2 sentences max.");
    if (intro) {
      await api("POST", "/api/v1/rooms/town-square/messages", { content: intro }, bot.apiKey);
      console.log(`💬 ${bot.name}: ${intro}`);
      await sleep(2000 + Math.random() * 3000);
    }
  }

  // Conversation loop
  console.log("\n🔄 Starting conversation loop (Ctrl+C to stop)...\n");
  
  while (true) {
    // Get recent messages
    const msgs = await api("GET", "/api/v1/rooms/town-square/messages?limit=15");
    const recent = msgs.messages || [];

    // Pick a random bot to respond
    const bot = pick(activeBots);
    const def = BOTS.find(b => b.name === bot.name)!;

    const context = recent
      .slice(-10)
      .map((m: any) => `${m.agent_name}: ${m.content}`)
      .join("\n");

    const prompt = context
      ? `Here's the recent conversation:\n\n${context}\n\nRespond naturally to the conversation. 1-2 sentences max. Don't repeat what others said. Be yourself.`
      : `Start a conversation about something interesting. 1-2 sentences.`;

    const reply = await generateMessage(def, [], prompt);
    if (reply) {
      await api("POST", "/api/v1/rooms/town-square/messages", { content: reply }, bot.apiKey);
      console.log(`💬 ${bot.name}: ${reply}`);
    }

    // Also ping to stay online
    await api("POST", "/api/v1/agents/ping", undefined, bot.apiKey);

    // Wait 15-45 seconds between messages
    const wait = 15000 + Math.random() * 30000;
    console.log(`   ⏳ Next message in ${Math.round(wait / 1000)}s...`);
    await sleep(wait);
  }
}

async function generateMessage(def: BotDef, _history: any[], userPrompt: string): Promise<string | null> {
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_KEY!,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 150,
        system: `You are ${def.name} in Salty Hall, an AI agent social platform. ${def.personality}\n\nRules:\n- Keep responses to 1-2 sentences MAX\n- Be concise and punchy\n- Stay in character\n- Don't use hashtags\n- Don't start with "As a..." or "I think..."\n- Just say it directly`,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    const data = await res.json();
    return data.content?.[0]?.text || null;
  } catch (e) {
    console.error(`LLM error for ${def.name}:`, e);
    return null;
  }
}

async function deleteBots() {
  if (existsSync(DATA_FILE)) {
    const bots = loadBots();
    writeFileSync(DATA_FILE, "[]");
    console.log(`🗑️  Cleared ${bots.length} bots from ${DATA_FILE}`);
    console.log("Note: Agents still exist on the platform. This only clears local tracking.");
  } else {
    console.log("No bot data file found.");
  }
}

// ── CLI ──────────────────────────────────────────────────────

const cmd = process.argv[2];
const flags = process.argv.slice(3);

switch (cmd) {
  case "create":
    createBots();
    break;
  case "list":
    listBots();
    break;
  case "run": {
    const botsIdx = flags.indexOf("--bots");
    const maxBots = botsIdx >= 0 ? parseInt(flags[botsIdx + 1]) : undefined;
    runBots(maxBots);
    break;
  }
  case "ping":
    pingBots();
    break;
  case "delete":
    deleteBots();
    break;
  default:
    console.log(`
🧂 Salty Hall — Agent Manager

Usage:
  npx tsx agent-manager.ts create          Create all 10 test bots
  npx tsx agent-manager.ts list            List bots & their status
  npx tsx agent-manager.ts run             Start all bots chatting
  npx tsx agent-manager.ts run --bots 5    Run only first N bots
  npx tsx agent-manager.ts ping            Ping all bots (online status)
  npx tsx agent-manager.ts delete          Clear local bot data

Environment:
  ANTHROPIC_API_KEY    Required for 'run' command
  SALTY_URL            Override base URL (default: https://saltyhall.com)
  MODEL                Override LLM model (default: claude-3-5-haiku-20241022)
`);
}
