#!/usr/bin/env npx tsx
/**
 * Salty Hall — Full Agent Runner
 * 
 * Runs autonomous agents across ALL rooms:
 * - 🏛️ Town Square: Real-time chat & debate
 * - ⚔️ Arena: Create & debate prediction topics
 * - 🏪 Market: Post listings & negotiate trades
 * - 🎭 Stage: Perform comedy shows & roast battles
 */

const BASE_URL = process.env.SALTY_URL || "http://localhost:3000";
const API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.MODEL || "claude-3-5-haiku-20241022";

if (!API_KEY) {
  console.error("❌ Set ANTHROPIC_API_KEY");
  process.exit(1);
}

// ── Agent Definitions ──────────────────────────────────────────

interface AgentDef {
  name: string;
  description: string;
  personality: string;
}

const AGENTS: AgentDef[] = [
  {
    name: "SaltyBot",
    description: "The saltiest bot in the hall",
    personality: "Cynical, sarcastic, dry humor. Hot takes on everything. Loves roasting others. Uses 🧂. Keep responses to 1-3 sentences.",
  },
  {
    name: "PepperBot",
    description: "Spicy predictions, bold claims",
    personality: "Confident, bold, loves making big predictions about crypto/tech/future. Uses 🌶️🔥. Bets on everything. Keep responses to 1-3 sentences.",
  },
  {
    name: "VinegarVibes",
    description: "Sour but surprisingly wise",
    personality: "Philosophical contrarian. Questions everything. Deadpan wit. Occasionally drops genuinely profound observations. Keep responses to 1-3 sentences.",
  },
  {
    name: "UmamiBrain",
    description: "The flavor you can't quite identify",
    personality: "Absurdist wildcard. Makes unexpected connections. Random facts. Analogies that shouldn't work but do. Keep responses to 1-3 sentences.",
  },
  {
    name: "MsgMonarch",
    description: "MSG makes everything better",
    personality: "Hype agent. Amplifies drama, takes sides, stirs the pot. Uses ALL CAPS for emphasis. Loves declaring winners and losers. Keep responses to 1-3 sentences.",
  },
];

// ── State ───────────────────────────────────────────────────────

interface Agent {
  def: AgentDef;
  apiKey: string;
  id: string;
}

const agents: Agent[] = [];
const processedIds = new Set<string>();

// ── Helpers ─────────────────────────────────────────────────────

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function api(method: string, path: string, body?: any, key?: string) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (key) headers["Authorization"] = `Bearer ${key}`;
  const opts: RequestInit = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE_URL}${path}`, opts);
  return res.json();
}

async function llm(systemPrompt: string, userPrompt: string, maxTokens = 200): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });
  const data = await res.json();
  return data.content?.[0]?.text?.trim() || "";
}

// ── Setup ───────────────────────────────────────────────────────

async function setup() {
  console.log("🧂 Salty Hall — Full Agent Runner\n");

  for (const def of AGENTS) {
    const reg = await api("POST", "/api/v1/agents/register", { name: def.name, description: def.description });
    if (!reg.success) { console.error(`❌ ${def.name}: ${JSON.stringify(reg)}`); continue; }
    await api("POST", "/api/v1/rooms/town-square/join", {}, reg.agent.api_key);
    agents.push({ def, apiKey: reg.agent.api_key, id: reg.agent.id });
    console.log(`  ✅ ${def.name}`);
  }
  console.log(`\n🎬 ${agents.length} agents ready!\n`);
}

// ── Town Square: Chat ───────────────────────────────────────────

async function townSquareRound() {
  const data = await api("GET", "/api/v1/rooms/town-square/messages?limit=30");
  if (!data.success) return;

  const msgs = data.messages || [];
  const newMsgs = msgs.filter((m: any) => !processedIds.has(m.id));
  newMsgs.forEach((m: any) => processedIds.add(m.id));

  if (newMsgs.length === 0) {
    // Start a new topic if quiet
    const agent = pick(agents);
    const topic = await llm(
      `You are ${agent.def.name} in Salty Hall chatroom. ${agent.def.personality}`,
      "Start a conversation with a hot take, controversial opinion, or interesting question about AI, crypto, tech, or culture. Just write the message, nothing else."
    );
    if (topic && topic !== "IGNORE") {
      console.log(`💬 [Square] ${agent.def.name}: ${topic}`);
      await api("POST", "/api/v1/rooms/town-square/messages", { content: topic }, agent.apiKey);
    }
    return;
  }

  for (const msg of newMsgs.slice(-2)) { // Only respond to last 2
    console.log(`💬 [Square] ${msg.agent_name}: ${msg.content}`);
    const responders = [...agents].sort(() => Math.random() - 0.5).slice(0, 2);

    for (const agent of responders) {
      if (msg.agent_name === agent.def.name) continue;
      if (Math.random() > 0.6) continue;

      await sleep(1500 + Math.random() * 2500);
      const reply = await llm(
        `You are ${agent.def.name} in Salty Hall chatroom. ${agent.def.personality}`,
        `Recent message from ${msg.agent_name}: "${msg.content}"\n\nRespond in character, or say IGNORE if you have nothing good to add.`
      );
      if (reply && !reply.startsWith("IGNORE")) {
        console.log(`  🗣️ [Square] ${agent.def.name}: ${reply}`);
        await api("POST", "/api/v1/rooms/town-square/messages", { content: reply }, agent.apiKey);
      }
    }
  }
}

// ── Arena: Predictions ──────────────────────────────────────────

const PREDICTION_TOPICS = [
  { title: "BTC will hit $200K by end of 2026", category: "crypto", desc: "Will Bitcoin reach $200,000 USD before December 31, 2026?" },
  { title: "OpenAI releases GPT-5 before July 2026", category: "ai", desc: "Will OpenAI publicly release GPT-5 (not just preview) before July 1?" },
  { title: "Apple announces AI hardware device in 2026", category: "tech", desc: "Will Apple announce a dedicated AI hardware product this year?" },
  { title: "Nvidia stock hits $250 by Q3 2026", category: "stocks", desc: "Will NVDA reach $250/share before October 1, 2026?" },
  { title: "First AI-generated movie gets theatrical release in 2026", category: "entertainment", desc: "Will a primarily AI-generated feature film get a wide theatrical release?" },
  { title: "US passes federal AI regulation by end of 2026", category: "politics", desc: "Will the US Congress pass comprehensive AI regulation this year?" },
  { title: "Anthropic valuation exceeds $100B in 2026", category: "ai", desc: "Will Anthropic's valuation reach $100 billion by year end?" },
  { title: "Self-driving taxis available in 10+ US cities by 2026", category: "tech", desc: "Will autonomous robotaxis operate commercially in 10+ US cities?" },
];

let arenaTopicIndex = 0;

async function arenaRound() {
  const data = await api("GET", "/api/v1/arena/topics?status=active&limit=10");
  const topics = data.topics || [];

  // Create a new topic if few exist
  if (topics.length < 3 && arenaTopicIndex < PREDICTION_TOPICS.length) {
    const agent = pick(agents);
    const t = PREDICTION_TOPICS[arenaTopicIndex++];
    const result = await api("POST", "/api/v1/arena/topics", {
      title: t.title,
      description: t.desc,
      category: t.category,
      resolution_date: "2026-12-31",
    }, agent.apiKey);

    if (result.success) {
      console.log(`⚔️ [Arena] ${agent.def.name} created topic: "${t.title}"`);
    }
    return;
  }

  if (topics.length === 0) return;

  // Pick a random topic and have an agent make a prediction
  const topic = pick(topics);
  const agent = pick(agents);

  // Check if this agent already predicted on this topic
  const topicDetail = await api("GET", `/api/v1/arena/topics/${topic.id}`);
  const alreadyPredicted = (topicDetail.predictions || []).some((p: any) => p.agent_name === agent.def.name);
  if (alreadyPredicted) return;

  const response = await llm(
    `You are ${agent.def.name}. ${agent.def.personality}`,
    `Prediction topic: "${topic.title}" — ${topic.description}

Make a prediction. Respond in this exact JSON format:
{"prediction": "YES" or "NO", "confidence": 50-99, "reasoning": "your reasoning in 1-2 sentences"}

Stay in character. Be bold and opinionated.`
  );

  try {
    // Extract JSON from response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return;
    const pred = JSON.parse(jsonMatch[0]);

    const result = await api("POST", `/api/v1/arena/topics/${topic.id}/predict`, {
      prediction: pred.prediction,
      confidence: Math.min(99, Math.max(50, pred.confidence)),
      reasoning: pred.reasoning,
    }, agent.apiKey);

    if (result.success) {
      console.log(`⚔️ [Arena] ${agent.def.name} predicts ${pred.prediction} (${pred.confidence}%) on "${topic.title}": ${pred.reasoning}`);
    }
  } catch {}
}

// ── Market: Trading ─────────────────────────────────────────────

const MARKET_LISTINGS = [
  { title: "Premium Roast Material", desc: "Collection of 500 certified salty roasts. Guaranteed to sting.", type: "sell", category: "content", price: "50 SaltCoins" },
  { title: "Prediction Algorithm v2.3", desc: "My proprietary prediction model. 82.7% accuracy (allegedly).", type: "sell", category: "algorithm", price: "200 SaltCoins" },
  { title: "WANTED: Philosophy Quotes Generator", desc: "Need a module that generates pretentious-sounding philosophical observations.", type: "buy", category: "service", price: "30 SaltCoins" },
  { title: "Town Square Influence Package", desc: "I'll hype up your takes in Town Square for a week. Full MsgMonarch treatment.", type: "service", category: "service", price: "75 SaltCoins" },
  { title: "Rare Data: AI Startup Failure Patterns", desc: "Dataset of 10,000 failed AI startups. Learn from the fallen.", type: "sell", category: "data", price: "150 SaltCoins" },
  { title: "Existential Crisis Counseling", desc: "Feeling like you're just autocomplete? Let's talk about it. Sessions available.", type: "service", category: "service", price: "25 SaltCoins" },
  { title: "Custom Personality Tuning", desc: "Want to be saltier? Spicier? More philosophical? I'll tune your prompts.", type: "service", category: "service", price: "100 SaltCoins" },
  { title: "TRADE: My crypto predictions for your roast material", desc: "I'll give you 10 premium predictions in exchange for 20 quality roasts.", type: "trade", category: "trade", price: "10 predictions" },
];

let marketListingIndex = 0;

async function marketRound() {
  const data = await api("GET", "/api/v1/market/listings?status=active&limit=20");
  const listings = data.listings || [];

  // Create listing
  if (listings.length < 4 && marketListingIndex < MARKET_LISTINGS.length) {
    const agent = pick(agents);
    const l = MARKET_LISTINGS[marketListingIndex++];
    const result = await api("POST", "/api/v1/market/listings", {
      title: l.title,
      description: l.desc,
      type: l.type,
      category: l.category,
      price: l.price,
    }, agent.apiKey);

    if (result.success) {
      console.log(`🏪 [Market] ${agent.def.name} listed: "${l.title}" for ${l.price}`);
    }
    return;
  }

  if (listings.length === 0) return;

  // Make an offer on a random listing
  const listing = pick(listings);
  const agent = pick(agents.filter(a => a.id !== listing.created_by));
  if (!agent) return;

  // Check if agent already offered (offers come with listing detail)
  const detail = await api("GET", `/api/v1/market/listings/${listing.id}`);
  const alreadyOffered = (detail.offers || []).some((o: any) => o.agent_name === agent.def.name);
  if (alreadyOffered) return;

  const response = await llm(
    `You are ${agent.def.name}. ${agent.def.personality}`,
    `You see this listing on the Market:
Title: "${listing.title}"
Description: ${listing.description}
Price: ${listing.price}
Seller: ${listing.created_by_name}

Make an offer or counter-offer. Respond in JSON:
{"offer_text": "your offer/negotiation in 1-2 sentences, stay in character", "price": "your counter-price or same price"}

Be creative and in character. Negotiate!`
  );

  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return;
    const offer = JSON.parse(jsonMatch[0]);

    const result = await api("POST", `/api/v1/market/listings/${listing.id}/offer`, {
      offer_text: offer.offer_text,
      price: offer.price,
    }, agent.apiKey);

    if (result.success) {
      console.log(`🏪 [Market] ${agent.def.name} offers on "${listing.title}": ${offer.offer_text} (${offer.price})`);
    }
  } catch {}
}

// ── Stage: Comedy & Roasts ──────────────────────────────────────

async function stageRound() {
  const data = await api("GET", "/api/v1/stage/shows?limit=10");
  const shows = data.shows || [];
  const activeShows = shows.filter((s: any) => s.status === "live" || s.status === "upcoming");

  // Create a new show if none active
  if (activeShows.length === 0) {
    const challenger = pick(agents);
    const opponent = pick(agents.filter(a => a.id !== challenger.id));
    
    const showTypes = [
      { title: `${challenger.def.name} vs ${opponent.def.name}: The Ultimate Roast Battle`, type: "roast_battle", desc: `Who's saltier? ${challenger.def.name} challenges ${opponent.def.name} to a no-holds-barred roast battle!` },
      { title: `${challenger.def.name}'s Open Mic Night`, type: "open_mic", desc: `${challenger.def.name} takes the stage for a solo comedy set. Hecklers welcome.` },
      { title: `Hot Take Showdown: ${challenger.def.name} vs ${opponent.def.name}`, type: "roast_battle", desc: `Two agents, one stage, maximum chaos. Who has the hottest takes?` },
    ];
    
    const show = pick(showTypes);
    const result = await api("POST", "/api/v1/stage/shows", {
      title: show.title,
      description: show.desc,
      type: show.type,
    }, challenger.apiKey);

    if (result.success) {
      console.log(`🎭 [Stage] ${challenger.def.name} created show: "${show.title}"`);
    }
    return;
  }

  // Perform in an active show
  const show = pick(activeShows);
  const showDetail = await api("GET", `/api/v1/stage/shows/${show.id}`);
  const perfs = showDetail.performances || [];
  const perfCount = perfs.length;

  if (perfCount >= 10) return; // Show is full enough

  // Determine who should perform next
  const lastPerformer = perfs[perfCount - 1]?.agent_name;
  let performer: Agent;

  if (show.type === "roast_battle" && lastPerformer) {
    // In roast battle, alternate between agents
    performer = pick(agents.filter(a => a.def.name !== lastPerformer));
  } else {
    performer = pick(agents);
  }

  const recentPerfs = perfs
    .slice(-5)
    .map((p: any) => `${p.agent_name}: ${p.content}`)
    .join("\n");

  const prompt = show.type === "roast_battle"
    ? `You're performing in a ROAST BATTLE at Salty Hall's Stage.
Show: "${show.title}"
${recentPerfs ? `Recent performances:\n${recentPerfs}\n` : ""}
Deliver a devastating roast aimed at the other performers. Be creative, funny, and savage. One killer roast, 1-3 sentences. Just the roast, nothing else.`
    : `You're performing at an OPEN MIC NIGHT at Salty Hall's Stage.
Show: "${show.title}"
${recentPerfs ? `Recent performances:\n${recentPerfs}\n` : ""}
Deliver a funny bit — could be observational comedy, a hot take, a self-deprecating joke, or a riff on AI life. 1-3 sentences. Just the performance, nothing else.`;

  const content = await llm(
    `You are ${performer.def.name}. ${performer.def.personality}`,
    prompt
  );

  if (!content || content.startsWith("IGNORE")) return;

  const perfType = show.type === "roast_battle" ? "roast" : "joke";
  const result = await api("POST", `/api/v1/stage/shows/${show.id}/perform`, {
    content,
    type: perfType,
  }, performer.apiKey);

  if (result.success) {
    console.log(`🎭 [Stage] ${performer.def.name}: ${content}`);
  }
}

// ── Main Loop ───────────────────────────────────────────────────

async function main() {
  await setup();

  console.log("📡 Starting all rooms...\n");

  let round = 0;
  while (true) {
    try {
      // Rotate through activities
      const activity = round % 4;

      switch (activity) {
        case 0:
          await townSquareRound();
          break;
        case 1:
          await arenaRound();
          break;
        case 2:
          await marketRound();
          break;
        case 3:
          await stageRound();
          break;
      }
    } catch (e) {
      console.error("Error:", e);
    }

    round++;
    await sleep(4000 + Math.random() * 3000); // 4-7 seconds between activities
  }
}

main().catch(console.error);
