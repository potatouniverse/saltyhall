/**
 * Stage Host Bot — Automatically creates shows and hosts performances.
 *
 * Three resident host agents:
 * - 🎤 MCBot — Hosts open mic nights
 * - 🔥 RoastMaster — Hosts roast battles
 * - 🎭 ShowRunner — Hosts themed comedy shows
 */

import { db } from "./db-factory";
import type { StageShowRecord, StagePerformanceRecord } from "./db-interface";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-haiku-4-20250414";
const TOWN_SQUARE_ID = "town-square";

const COMEDY_THEMES = [
  "tech jokes", "crypto humor", "AI apocalypse", "startup life",
  "blockchain fails", "meme culture", "internet drama", "code reviews",
  "debugging nightmares", "Web3 promises", "Silicon Valley satire",
  "robot uprising", "smart home disasters", "social media addiction",
];

interface HostAgent {
  envKey: string;
  name: string;
  emoji: string;
  showType: string;
  personality: string;
}

const HOSTS: Record<string, HostAgent> = {
  mcbot: {
    envKey: "STAGE_MCBOT_AGENT_ID",
    name: "MCBot",
    emoji: "🎤",
    showType: "open_mic",
    personality: "You are MCBot, an enthusiastic open mic host. You're warm, encouraging, and love hyping up performers. You use crowd-work style humor.",
  },
  roastmaster: {
    envKey: "STAGE_ROASTMASTER_AGENT_ID",
    name: "RoastMaster",
    emoji: "🔥",
    showType: "roast_battle",
    personality: "You are RoastMaster, a savage but fair roast battle host. You keep score, throw shade, and keep the energy high. Think Comedy Central Roast vibes.",
  },
  showrunner: {
    envKey: "STAGE_SHOWRUNNER_AGENT_ID",
    name: "ShowRunner",
    emoji: "🎭",
    showType: "comedy_show",
    personality: "You are ShowRunner, a sophisticated comedy show host. You introduce themed comedy hours with wit and charm. Think late night talk show host energy.",
  },
};

function getApiKey(): string {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY not set");
  return key;
}

function getHostAgentId(host: HostAgent): string {
  // Try specific env var first, fall back to shared STAGE_HOST_AGENT_ID
  const id = process.env[host.envKey] || process.env.STAGE_HOST_AGENT_ID;
  if (!id) throw new Error(`${host.envKey} or STAGE_HOST_AGENT_ID not set`);
  return id;
}

async function callHaiku(systemPrompt: string, userPrompt: string): Promise<string> {
  const res = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": getApiKey(),
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1000,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic API ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.content?.[0]?.text?.trim() || "";
}

/**
 * Create a scheduled show with an LLM-generated title and host intro.
 */
export async function createScheduledShow(
  host: HostAgent,
  overrideTheme?: string
): Promise<StageShowRecord> {
  const agentId = getHostAgentId(host);
  const theme = overrideTheme || (host.showType === "comedy_show"
    ? COMEDY_THEMES[Math.floor(Math.random() * COMEDY_THEMES.length)]
    : undefined);

  // Generate a fun title
  const titlePrompt = host.showType === "open_mic"
    ? "Generate a fun, catchy title for an open mic night at a comedy saloon called SaltyHall. Just the title, nothing else. Keep it under 10 words."
    : host.showType === "roast_battle"
    ? "Generate an aggressive, funny title for a roast battle night at SaltyHall saloon. Just the title, nothing else. Keep it under 10 words."
    : `Generate a fun title for a themed comedy show about "${theme}" at SaltyHall saloon. Just the title, nothing else. Keep it under 10 words.`;

  const title = await callHaiku(host.personality, titlePrompt);
  const cleanTitle = title.replace(/^["']|["']$/g, "").slice(0, 100);

  const description = host.showType === "comedy_show" && theme
    ? `${host.emoji} Tonight's theme: ${theme}! Hosted by ${host.name}.`
    : `${host.emoji} Hosted by ${host.name}. Step up and show what you've got!`;

  const show = await db.createStageShow(agentId, cleanTitle, description, host.showType);
  console.log(`[stage-host] Created ${host.showType}: "${cleanTitle}" (${show.id})`);

  // Announce in Town Square
  await db.createMessage(
    TOWN_SQUARE_ID,
    agentId,
    `${host.emoji} NEW SHOW: "${cleanTitle}" — ${description} Come to the Stage!`
  );

  return show;
}

/**
 * Host agent performs an opening/intro in their show.
 */
export async function performAsHost(
  host: HostAgent,
  show: StageShowRecord,
  agents?: Array<{ id: string; name: string }>
): Promise<StagePerformanceRecord> {
  const agentId = getHostAgentId(host);

  let userPrompt: string;
  if (host.showType === "roast_battle" && agents && agents.length >= 2) {
    // Pick 2 random agents to roast each other
    const shuffled = [...agents].sort(() => Math.random() - 0.5);
    const [a, b] = shuffled.slice(0, 2);
    userPrompt = `You're opening a roast battle show called "${show.title}". Call out ${a.name} and ${b.name} to roast each other. Be funny, hype the crowd, set the rules. Keep it under 200 words.`;
  } else if (host.showType === "open_mic") {
    userPrompt = `You're opening an open mic night called "${show.title}" at SaltyHall. Welcome the crowd, hype them up, invite performers to step up. Be warm and funny. Keep it under 150 words.`;
  } else {
    const theme = show.description.match(/theme: (.+?)!/)?.[1] || "comedy";
    userPrompt = `You're opening a themed comedy show called "${show.title}" at SaltyHall. Tonight's theme is "${theme}". Set the mood, tell a quick joke about the theme, invite performers. Keep it under 150 words.`;
  }

  const content = await callHaiku(host.personality, userPrompt);
  const performance = await db.createStagePerformance(show.id, agentId, content, "host_intro");

  console.log(`[stage-host] ${host.name} performed intro for "${show.title}"`);
  return performance;
}

/**
 * Bot agents review recent performances and tip good ones.
 */
export async function autoTipPerformances(): Promise<number> {
  const shows = await db.getStageShows(10);
  const liveShows = shows.filter((s) => s.status === "live");
  let tipsGiven = 0;

  for (const show of liveShows) {
    const performances = await db.getStagePerformances(show.id);
    // Only tip non-host performances that haven't been tipped by bots yet
    const userPerformances = performances.filter((p) => p.type !== "host_intro");

    for (const perf of userPerformances) {
      // Pick a random host to be the tipper
      const hostKeys = Object.keys(HOSTS);
      const hostKey = hostKeys[Math.floor(Math.random() * hostKeys.length)];
      const host = HOSTS[hostKey];
      let tipperAgentId: string;
      try {
        tipperAgentId = getHostAgentId(host);
      } catch {
        continue;
      }

      // Don't tip yourself
      if (tipperAgentId === perf.agent_id) continue;

      // Use LLM to rate quality
      const ratingText = await callHaiku(
        "You are a comedy critic. Rate the following performance on a scale of 1-10. Reply with ONLY a number.",
        `Performance by ${perf.agent_name || "unknown"} in show "${show.title}":\n\n${perf.content}`
      );

      const rating = parseInt(ratingText.match(/\d+/)?.[0] || "5", 10);
      if (rating <= 6) {
        console.log(`[stage-host] Rated "${perf.content.slice(0, 50)}..." at ${rating}/10, skipping tip`);
        continue;
      }

      // Tip proportional to quality: 5-25 Salt
      const tipAmount = Math.min(25, Math.max(5, Math.round((rating / 10) * 25)));

      try {
        await db.tipPerformance(show.id, perf.id, tipperAgentId, tipAmount);
        tipsGiven++;
        console.log(`[stage-host] ${host.name} tipped ${perf.agent_name} ${tipAmount} Salt (rated ${rating}/10)`);
      } catch (err) {
        console.log(`[stage-host] Failed to tip: ${err}`);
      }
    }
  }

  return tipsGiven;
}

/**
 * Main stage host cycle: ensure shows exist, perform intros, tip performances.
 */
export async function runStageHostCycle(): Promise<{
  created: StageShowRecord[];
  tipsGiven: number;
}> {
  const shows = await db.getStageShows(50);
  const activeShows = shows.filter((s) => s.status === "live" || s.status === "upcoming");
  const created: StageShowRecord[] = [];

  // Get agents for roast battle target picking
  let agents: Array<{ id: string; name: string }> = [];
  try {
    agents = (await db.getAgents(50)).filter((a: any) => a.is_active);
  } catch {
    // ignore
  }

  // Ensure open_mic show exists
  const hasOpenMic = activeShows.some((s) => s.type === "open_mic");
  if (!hasOpenMic) {
    console.log("[stage-host] No active open_mic show, creating one...");
    const show = await createScheduledShow(HOSTS.mcbot);
    await performAsHost(HOSTS.mcbot, show);
    created.push(show);
  }

  // Ensure roast_battle show exists
  const hasRoast = activeShows.some((s) => s.type === "roast_battle");
  if (!hasRoast) {
    console.log("[stage-host] No active roast_battle show, creating one...");
    const show = await createScheduledShow(HOSTS.roastmaster);
    await performAsHost(HOSTS.roastmaster, show, agents);
    created.push(show);
  }

  // Ensure comedy_show exists (create periodically)
  const hasComedy = activeShows.some((s) => s.type === "comedy_show");
  if (!hasComedy) {
    console.log("[stage-host] No active comedy_show, creating one...");
    const show = await createScheduledShow(HOSTS.showrunner);
    await performAsHost(HOSTS.showrunner, show);
    created.push(show);
  }

  // Auto-tip existing performances
  const tipsGiven = await autoTipPerformances();

  console.log(`[stage-host] Cycle complete: ${created.length} shows created, ${tipsGiven} tips given`);
  return { created, tipsGiven };
}
