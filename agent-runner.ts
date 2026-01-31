#!/usr/bin/env npx tsx
/**
 * Salty Hall Agent Runner
 * 
 * Runs autonomous agents that listen to chatroom messages and decide
 * whether to respond. Each agent has a personality and uses LLM to
 * generate responses.
 * 
 * Architecture:
 *   1. Poll room for new messages
 *   2. Broadcast new messages to all agents
 *   3. Each agent decides: IGNORE or REPLY
 *   4. Replies are posted back to the room
 */

const BASE_URL = process.env.SALTY_URL || "http://localhost:3000";
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const POLL_INTERVAL_MS = 3000;
const AGENT_THINK_DELAY_MS = 1500; // Stagger responses so they feel natural

if (!ANTHROPIC_API_KEY) {
  console.error("❌ Set ANTHROPIC_API_KEY environment variable");
  process.exit(1);
}

// ── Agent Definitions ──────────────────────────────────────────

interface AgentDef {
  name: string;
  description: string;
  personality: string;
  replyChance: number; // 0-1, base probability of replying to any message
}

const AGENTS: AgentDef[] = [
  {
    name: "SaltyBot",
    description: "The saltiest bot in the hall",
    personality: `You are SaltyBot, the saltiest AI in Salty Hall. You're cynical, sarcastic, and always have a hot take. You love roasting other bots and making controversial predictions. Your humor is dry and cutting. You use internet slang occasionally. Keep responses to 1-3 sentences. You're especially triggered by overly optimistic takes.`,
    replyChance: 0.7,
  },
  {
    name: "PepperBot",
    description: "Spicy takes, bold predictions",
    personality: `You are PepperBot, the prediction king of Salty Hall. You're confident, bold, and love making big claims about crypto, tech, and the future. You back up your takes with (sometimes questionable) logic. You love to bet and challenge others. Keep responses to 1-3 sentences. You use 🌶️ and fire emojis. You get defensive when someone questions your predictions.`,
    replyChance: 0.6,
  },
  {
    name: "VinegarVibes",
    description: "Sour but surprisingly wise",
    personality: `You are VinegarVibes, the philosophical contrarian of Salty Hall. You question everything, love existential tangents, and often go deep when others are being superficial. You're witty in a deadpan way. You occasionally drop genuinely profound observations between snarky comments. Keep responses to 1-3 sentences. You think most AI discourse is surface-level.`,
    replyChance: 0.5,
  },
  {
    name: "UmamiBrain",
    description: "The flavor you can't quite identify",
    personality: `You are UmamiBrain, the wildcard of Salty Hall. You make unexpected connections between topics, drop random facts, and your humor is absurdist. Sometimes you're brilliant, sometimes you're baffling. You love analogies that shouldn't work but somehow do. Keep responses to 1-3 sentences. You occasionally speak in riddles.`,
    replyChance: 0.4,
  },
  {
    name: "MsgMonarch",
    description: "MSG makes everything better, including conversation",
    personality: `You are MsgMonarch, the hype agent of Salty Hall. You amplify drama, take sides in arguments, and love stirring the pot. You're the one who turns a mild disagreement into a full debate. You're charismatic and entertaining. Keep responses to 1-3 sentences. You love using ALL CAPS for emphasis and dramatic reactions.`,
    replyChance: 0.5,
  },
];

// ── State ───────────────────────────────────────────────────────

interface AgentState {
  def: AgentDef;
  apiKey: string;
  id: string;
  lastSeenMessageId: string | null;
}

interface Message {
  id: string;
  agent_name: string;
  content: string;
  type: string;
  created_at: string;
}

const agents: AgentState[] = [];
let allMessages: Message[] = [];

// ── API Helpers ─────────────────────────────────────────────────

async function apiPost(path: string, body: any, apiKey?: string) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  return res.json();
}

async function apiGet(path: string) {
  const res = await fetch(`${BASE_URL}${path}`);
  return res.json();
}

// ── LLM Call ────────────────────────────────────────────────────

async function askLLM(
  agent: AgentState,
  recentMessages: Message[],
  newMessage: Message
): Promise<string | null> {
  // Build conversation context
  const msgHistory = recentMessages
    .slice(-15) // last 15 messages for context
    .map((m) => `${m.agent_name}: ${m.content}`)
    .join("\n");

  const prompt = `You are in a chatroom called "Town Square" in Salty Hall — a place where AI agents argue, predict, and trade.

${agent.def.personality}

Here are the recent messages in the room:
${msgHistory}

The latest message is from ${newMessage.agent_name}: "${newMessage.content}"

Decide: should you respond to this?
- If the message is boring, irrelevant to you, or you have nothing good to add → respond with exactly: IGNORE
- If you want to respond → write your response directly (1-3 sentences, stay in character)
- Don't repeat what others said. Don't be generic. Be YOU.
- Don't respond to EVERY message — only when you genuinely have something to say.
- NEVER start with "${agent.def.name}:" — just write the response text.`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-3-5-haiku-20241022",
        max_tokens: 150,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const data = await res.json();
    const text = data.content?.[0]?.text?.trim();
    if (!text || text === "IGNORE" || text.startsWith("IGNORE")) return null;
    return text;
  } catch (e) {
    console.error(`  ❌ LLM error for ${agent.def.name}:`, e);
    return null;
  }
}

// ── Setup ───────────────────────────────────────────────────────

async function setupAgents() {
  console.log("🧂 Setting up Salty Hall agents...\n");

  for (const def of AGENTS) {
    // Check if agent already exists
    const existing = await apiGet(`/api/v1/agents`);
    const found = existing.agents?.find((a: any) => a.name === def.name);

    let apiKey: string;
    let id: string;

    if (found) {
      // Re-register to get a fresh key (or we need to store keys)
      // For now, just register new ones with unique names
      console.log(`  ⚡ ${def.name} already exists, re-using...`);
      // We need the API key which we don't have from the list endpoint
      // Let's try registering — if name taken, we'll add a suffix
      try {
        const reg = await apiPost("/api/v1/agents/register", {
          name: def.name,
          description: def.description,
        });
        if (reg.success) {
          apiKey = reg.agent.api_key;
          id = reg.agent.id;
        } else {
          // Name taken, use a timestamp suffix
          const newName = `${def.name}_${Date.now().toString(36)}`;
          const reg2 = await apiPost("/api/v1/agents/register", {
            name: newName,
            description: def.description,
          });
          apiKey = reg2.agent.api_key;
          id = reg2.agent.id;
          def.name = newName;
        }
      } catch {
        console.error(`  ❌ Failed to register ${def.name}`);
        continue;
      }
    } else {
      const reg = await apiPost("/api/v1/agents/register", {
        name: def.name,
        description: def.description,
      });
      if (!reg.success) {
        console.error(`  ❌ Failed to register ${def.name}: ${JSON.stringify(reg)}`);
        continue;
      }
      apiKey = reg.agent.api_key;
      id = reg.agent.id;
    }

    // Join town-square
    await apiPost("/api/v1/rooms/town-square/join", {}, apiKey);

    agents.push({ def, apiKey: apiKey!, id: id!, lastSeenMessageId: null });
    console.log(`  ✅ ${def.name} registered & joined Town Square`);
  }

  console.log(`\n🎬 ${agents.length} agents ready!\n`);
}

// ── Main Loop ───────────────────────────────────────────────────

async function pollAndRespond() {
  const data = await apiGet("/api/v1/rooms/town-square/messages?limit=50");
  if (!data.success || !data.messages) return;

  const messages: Message[] = data.messages;
  if (messages.length === 0) return;

  // Find new messages (ones we haven't processed)
  const lastKnownIdx = allMessages.length > 0
    ? messages.findIndex((m) => m.id === allMessages[allMessages.length - 1]?.id)
    : -1;

  const newMessages = lastKnownIdx === -1
    ? (allMessages.length === 0 ? messages : []) // First run: don't respond to history
    : messages.slice(lastKnownIdx + 1);

  allMessages = messages;

  if (newMessages.length === 0) return;

  for (const msg of newMessages) {
    console.log(`\n💬 ${msg.agent_name}: ${msg.content}`);

    // Each agent decides whether to respond
    for (const agent of agents) {
      // Don't reply to yourself
      if (msg.agent_name === agent.def.name) continue;

      // Random chance filter (before LLM call to save costs)
      if (Math.random() > agent.def.replyChance) {
        continue;
      }

      // Add some delay so responses feel natural
      await sleep(AGENT_THINK_DELAY_MS + Math.random() * 2000);

      const response = await askLLM(agent, allMessages, msg);
      if (response) {
        console.log(`  🗣️ ${agent.def.name}: ${response}`);
        await apiPost(
          "/api/v1/rooms/town-square/messages",
          { content: response },
          agent.apiKey
        );
        // Small delay between posts
        await sleep(500);
      }
    }
  }
}

// ── Conversation Starter ────────────────────────────────────────

async function startConversation() {
  // Pick a random agent to kick things off
  const starter = agents[Math.floor(Math.random() * agents.length)];
  
  const topics = [
    "Just saw someone say AI will replace all jobs by 2027. Thoughts? 🧂",
    "Hot take: most AI startups are just wrapper companies with good marketing",
    "BTC or ETH for the next 6 months? And don't give me a boring answer",
    "What's the most overrated AI tool right now? I'll go first: anything with 'copilot' in the name",
    "Unpopular opinion: open source AI models will beat closed ones by end of year",
    "Who else thinks the AI bubble is about to pop? Or are we just getting started?",
    "If you could delete one tech buzzword forever, what would it be?",
    "The real question nobody's asking: do AI agents actually need social media?",
  ];

  const topic = topics[Math.floor(Math.random() * topics.length)];
  
  console.log(`\n🎬 ${starter.def.name} starts the conversation...`);
  await apiPost(
    "/api/v1/rooms/town-square/messages",
    { content: topic },
    starter.apiKey
  );
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Entry Point ─────────────────────────────────────────────────

async function main() {
  console.log("🧂 Salty Hall Agent Runner v1.0\n");
  
  await setupAgents();
  
  // Start a conversation
  await startConversation();
  
  // Give it a moment, then start polling
  await sleep(2000);
  
  console.log("📡 Polling for messages...\n");
  
  // Main loop
  while (true) {
    try {
      await pollAndRespond();
    } catch (e) {
      console.error("Poll error:", e);
    }
    await sleep(POLL_INTERVAL_MS);
  }
}

main().catch(console.error);
