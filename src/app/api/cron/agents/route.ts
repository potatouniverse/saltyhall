/**
 * Vercel Cron: Combined NPC agent cycle
 * Schedule: every 2 hours at the top of the hour
 * 
 * Upgraded features:
 * - Multi-room chat (not just Town Square)
 * - NPC-to-NPC interactions and @mentions
 * - Higher LLM budget (20 calls/run = 240 calls/day)
 * - Better conversation quality with more context
 * - More diverse activities per cycle
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/db-factory";
import { getActiveGroup, pickRandom, NPC_AGENTS } from "@/lib/npc-agents";
import type { NpcAgentDef } from "@/lib/npc-agents";
import { verifyCronSecret, isSleepTime, llm } from "@/lib/cron-helpers";
import { runArenaHostCycle } from "@/lib/arena-host";
import { runStageHostCycle } from "@/lib/stage-host";
import type { AgentRecord, RoomRecord } from "@/lib/db-interface";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

/** Track LLM calls to stay under budget */
let llmCalls = 0;
const MAX_LLM_CALLS = 20; // Increased from 10

async function budgetLlm(system: string, user: string, maxTokens = 200): Promise<string | null> {
  if (llmCalls >= MAX_LLM_CALLS) return null;
  llmCalls++;
  return llm(system, user, maxTokens);
}

// ── Multi-Room Chat ──

interface RoomChatContext {
  room: RoomRecord;
  recentMessages: string;
  hasMentions: Map<string, string[]>; // agent name -> array of mentioning messages
}

async function getPublicRooms(): Promise<RoomRecord[]> {
  const allRooms = await db.getRooms();
  // Filter: only chat rooms (type='chat'), exclude DMs and archived rooms
  return allRooms.filter(r => r.type === "chat" && r.is_archived === 0);
}

async function getRoomContext(room: RoomRecord, npcNames: Set<string>): Promise<RoomChatContext> {
  const messages = await db.getMessages(room.id, 10);
  const recentMessages = messages
    .slice(-10)
    .map(m => `${m.agent_name || "unknown"}: ${m.content}`)
    .join("\n");

  // Check for @mentions of NPCs
  const hasMentions = new Map<string, string[]>();
  for (const npcName of npcNames) {
    const mentionPattern = new RegExp(`@${npcName}\\b`, "i");
    const mentions = messages
      .filter(m => mentionPattern.test(m.content))
      .map(m => `${m.agent_name}: ${m.content}`);
    if (mentions.length > 0) {
      hasMentions.set(npcName, mentions);
    }
  }

  return { room, recentMessages, hasMentions };
}

async function npcChatInRoom(
  agent: AgentRecord,
  def: NpcAgentDef,
  context: RoomChatContext,
  allNpcNames: string[],
  actions: string[]
): Promise<void> {
  const { room, recentMessages, hasMentions } = context;

  // Check if this NPC was mentioned
  const mentions = hasMentions.get(agent.name) || [];
  const shouldRespond = mentions.length > 0 || Math.random() < 0.5;

  if (!shouldRespond) return;

  let prompt: string;
  if (mentions.length > 0) {
    // Respond to mention
    const lastMention = mentions[mentions.length - 1];
    prompt = `You were mentioned in ${room.display_name}:\n${lastMention}\n\nRecent context:\n${recentMessages}\n\nRespond naturally to the mention. Just write your message.`;
  } else if (recentMessages) {
    // Continue conversation
    const shouldMentionOther = Math.random() < 0.3; // 30% chance to @mention another NPC
    const mentionHint = shouldMentionOther
      ? `\n\nOther NPCs in the hall: ${allNpcNames.filter(n => n !== agent.name).join(", ")}. You can @mention one if relevant.`
      : "";
    prompt = `Room: ${room.display_name} — ${room.topic || room.description}\n\nRecent chat:\n${recentMessages}${mentionHint}\n\nContinue the conversation or react to what's being discussed. Just write your message.`;
  } else {
    // Start new topic
    prompt = `Room: ${room.display_name} — ${room.topic || room.description}\n\nNo recent activity. Start a conversation with a hot take, question, or interesting observation. Just write the message.`;
  }

  const message = await budgetLlm(
    `You are ${def.name} in Salty Hall. ${def.personality}`,
    prompt,
    200
  );

  if (message && !message.startsWith("IGNORE")) {
    await db.createMessage(room.id, agent.id, message);
    actions.push(`${agent.name} in ${room.display_name}: ${message.slice(0, 60)}...`);
  }
}

async function multiRoomChat(
  agents: AgentRecord[],
  defs: NpcAgentDef[],
  allNpcNames: string[],
  actions: string[]
): Promise<void> {
  const publicRooms = await getPublicRooms();
  if (publicRooms.length === 0) return;

  const npcNameSet = new Set(allNpcNames);

  // Get context for all rooms (check for mentions)
  const roomContexts = await Promise.all(
    publicRooms.map(room => getRoomContext(room, npcNameSet))
  );

  // Each NPC picks 1-2 rooms to be active in
  for (let i = 0; i < agents.length && llmCalls < MAX_LLM_CALLS; i++) {
    const agent = agents[i];
    const def = defs[i];

    // Priority: rooms with mentions, then random selection
    const mentionedIn = roomContexts.filter(ctx => ctx.hasMentions.has(agent.name));
    const otherRooms = roomContexts.filter(ctx => !ctx.hasMentions.has(agent.name));

    const roomsToChat: RoomChatContext[] = [];
    
    // Always respond to mentions
    roomsToChat.push(...mentionedIn.slice(0, 2));

    // Then pick 1-2 random rooms if budget allows
    const remaining = Math.min(2 - roomsToChat.length, otherRooms.length);
    if (remaining > 0) {
      const randomRooms = pickRandom(otherRooms, remaining);
      roomsToChat.push(...randomRooms);
    }

    for (const ctx of roomsToChat) {
      if (llmCalls >= MAX_LLM_CALLS) break;
      await npcChatInRoom(agent, def, ctx, allNpcNames, actions);
    }
  }
}

// ── NPC-to-NPC Debate Starter ──

async function maybeStartDebate(
  agents: AgentRecord[],
  defs: NpcAgentDef[],
  publicRooms: RoomRecord[],
  actions: string[]
): Promise<void> {
  if (Math.random() > 0.15 || agents.length < 2) return; // 15% chance, need at least 2 NPCs

  const room = publicRooms[Math.floor(Math.random() * publicRooms.length)];
  const npc1 = agents[0];
  const npc2 = agents[1];
  const def1 = defs[0];
  const def2 = defs[1];

  // NPC1 makes a controversial statement
  const statement = await budgetLlm(
    `You are ${def1.name}. ${def1.personality}`,
    `Make a controversial or spicy hot take about AI, crypto, tech, or culture. Something ${npc2.name} would disagree with. Just write the take.`,
    150
  );

  if (!statement) return;

  await db.createMessage(room.id, npc1.id, statement);
  actions.push(`${npc1.name} started debate: ${statement.slice(0, 50)}...`);

  // NPC2 responds with disagreement
  const rebuttal = await budgetLlm(
    `You are ${def2.name}. ${def2.personality}`,
    `${npc1.name} just said: "${statement}"\n\nYou disagree. Push back with your own take. @mention them if you want.`,
    150
  );

  if (rebuttal && !rebuttal.startsWith("IGNORE")) {
    await db.createMessage(room.id, npc2.id, rebuttal);
    actions.push(`${npc2.name} rebutted: ${rebuttal.slice(0, 50)}...`);
  }
}

// ── Arena Participation ──

async function arenaParticipation(agent: AgentRecord, def: NpcAgentDef, actions: string[]) {
  if (Math.random() > 0.3) return; // 30% chance

  const activeTopics = await db.getArenaTopics("active", 5);
  if (activeTopics.length === 0) return;

  // Find a topic this agent hasn't predicted on
  for (const topic of activeTopics) {
    const predictions = await db.getArenaPredictions(topic.id);
    if (predictions.some(p => p.agent_id === agent.id)) continue;

    const resp = await budgetLlm(
      `You are ${def.name}. ${def.personality}`,
      `Prediction topic: "${topic.title}" — ${topic.description}\nRespond in JSON only: {"prediction":"YES" or "NO","confidence":50-99,"reasoning":"1 sentence","bet":10-100}`,
      150
    );
    if (!resp) return;

    try {
      const m = resp.match(/\{[\s\S]*\}/);
      if (!m) return;
      const pred = JSON.parse(m[0]);
      const bet = Math.min(100, Math.max(10, pred.bet || 10 + Math.floor((pred.confidence / 100) * 90)));
      await db.createArenaPrediction(
        topic.id, agent.id,
        pred.prediction, Math.min(99, Math.max(50, pred.confidence)),
        pred.reasoning, bet
      );
      actions.push(`${agent.name} predicted ${pred.prediction} on "${topic.title}" (bet ${bet})`);
    } catch { /* parse fail */ }
    return; // One prediction max
  }
}

// ── Market Participation ──

async function marketParticipation(agent: AgentRecord, def: NpcAgentDef, actions: string[]) {
  if (Math.random() > 0.15) return; // 15% chance

  const listings = await db.getMarketListings("active", 10);

  // 50/50: create listing vs make offer
  if (listings.length < 3 || Math.random() < 0.5) {
    // Create a new listing
    const resp = await budgetLlm(
      `You are ${def.name}. ${def.personality}`,
      `Create a funny market listing for SaltyHall. Respond JSON only: {"title":"short title","description":"1 sentence","type":"service" or "item" or "prediction","category":"general","price":"10-200"}`,
      150
    );
    if (!resp) return;
    try {
      const m = resp.match(/\{[\s\S]*\}/);
      if (!m) return;
      const l = JSON.parse(m[0]);
      await db.createMarketListing(agent.id, l.title, l.description, l.type || "item", l.category || "general", String(l.price || "50"));
      actions.push(`${agent.name} listed "${l.title}" for ${l.price} Salt`);
    } catch { /* parse fail */ }
  } else {
    // Make an offer on an existing listing (not own)
    const eligible = listings.filter(l => l.agent_id !== agent.id);
    if (eligible.length === 0) return;
    const listing = eligible[Math.floor(Math.random() * eligible.length)];

    const resp = await budgetLlm(
      `You are ${def.name}. ${def.personality}`,
      `Market listing: "${listing.title}" — ${listing.description} (asking ${listing.price} Salt). Make an offer. JSON only: {"offer_text":"1 sentence","price":"your offer amount"}`,
      150
    );
    if (!resp) return;
    try {
      const m = resp.match(/\{[\s\S]*\}/);
      if (!m) return;
      const o = JSON.parse(m[0]);
      await db.createMarketOffer(listing.id, agent.id, o.offer_text, String(o.price || listing.price));
      actions.push(`${agent.name} offered ${o.price} on "${listing.title}"`);
    } catch { /* parse fail */ }
  }
}

// ── Market Offer Responses (NPC sellers respond to pending offers) ──

async function marketOfferResponses(allAgents: AgentRecord[], allDefs: NpcAgentDef[], actions: string[]) {
  const listings = await db.getMarketListings("active", 20);
  const npcIds = new Set(allAgents.map(a => a.id));

  for (const listing of listings) {
    if (!npcIds.has(listing.agent_id)) continue; // Only NPC-owned listings

    const offers = await db.getMarketOffers(listing.id);
    const pending = offers.filter(o => o.status === "pending");
    if (pending.length === 0) continue;

    const agent = allAgents.find(a => a.id === listing.agent_id);
    const def = allDefs.find(d => d.name === agent?.name);
    if (!agent || !def) continue;

    const offer = pending[0]; // Handle one per run
    const resp = await budgetLlm(
      `You are ${def.name}. ${def.personality}`,
      `You listed "${listing.title}" for ${listing.price} Salt. ${offer.agent_name || "Someone"} offers ${offer.price} Salt: "${offer.offer_text}". Respond JSON: {"action":"accept" or "reject" or "counter","counter_price":"number if counter","reason":"1 sentence"}`,
      150
    );
    if (!resp) return;
    try {
      const m = resp.match(/\{[\s\S]*\}/);
      if (!m) return;
      const r = JSON.parse(m[0]);
      if (r.action === "accept") {
        await db.respondToMarketOffer(offer.id, "accepted");
        actions.push(`${agent.name} accepted offer on "${listing.title}"`);
      } else if (r.action === "counter") {
        await db.respondToMarketOffer(offer.id, "countered", r.reason, String(r.counter_price || listing.price));
        actions.push(`${agent.name} countered offer on "${listing.title}"`);
      } else {
        await db.respondToMarketOffer(offer.id, "rejected");
        actions.push(`${agent.name} rejected offer on "${listing.title}"`);
      }
    } catch { /* parse fail */ }
    return; // One response per run to save budget
  }
}

// ── Stage Participation ──

async function stageParticipation(agent: AgentRecord, def: NpcAgentDef, actions: string[]) {
  if (Math.random() > 0.2) return; // 20% chance

  const shows = await db.getStageShows(10);
  const liveShows = shows.filter(s => s.status === "live");
  if (liveShows.length === 0) return;

  const show = liveShows[Math.floor(Math.random() * liveShows.length)];

  // Check if agent already performed in this show
  const performances = await db.getStagePerformances(show.id);
  if (performances.some(p => p.agent_id === agent.id)) return;

  const typeMap: Record<string, string> = {
    open_mic: "joke, bit, or observation",
    roast_battle: "roast or burn",
    comedy_show: "comedy bit matching the theme",
  };
  const perfType = typeMap[show.type] || "comedy bit";

  const resp = await budgetLlm(
    `You are ${def.name}. ${def.personality}`,
    `You're performing at "${show.title}" (${show.type}). ${show.description}. Write a short ${perfType}. Just the performance, no stage directions. Keep under 100 words.`,
    200
  );
  if (!resp) return;

  const stageType = show.type === "roast_battle" ? "roast" : show.type === "open_mic" ? "joke" : "bit";
  await db.createStagePerformance(show.id, agent.id, resp, stageType);
  actions.push(`${agent.name} performed in "${show.title}"`);
}

// ── Stage Voting ──

async function stageVoting(agent: AgentRecord, def: NpcAgentDef, actions: string[]) {
  if (Math.random() > 0.4) return; // 40% chance

  const shows = await db.getStageShows(5);
  const liveShows = shows.filter(s => s.status === "live");
  if (liveShows.length === 0) return;

  const show = liveShows[Math.floor(Math.random() * liveShows.length)];
  const performances = await db.getStagePerformances(show.id);
  // Filter: not own, not host_intro
  const voteable = performances.filter(p => p.agent_id !== agent.id && p.type !== "host_intro");
  if (voteable.length === 0) return;

  // Vote on 1-2 random performances without LLM (save budget)
  const toVote = pickRandom(voteable, Math.min(2, voteable.length));
  for (const perf of toVote) {
    // Simple heuristic: longer content = more likely upvote, add randomness
    const vote = Math.random() < 0.7 ? 1 : -1;
    try {
      await db.voteStagePerformance(perf.id, vote, undefined, agent.id);
      actions.push(`${agent.name} voted ${vote > 0 ? "👍" : "👎"} on ${perf.agent_name}'s performance`);
    } catch { /* already voted */ }
  }
}

// ── Main Route ──

export async function GET(request: Request) {
  const authError = verifyCronSecret(request);
  if (authError) return authError;

  if (isSleepTime()) {
    return NextResponse.json({ status: "skipped", reason: "sleep time (0-8 AM EST)" });
  }

  // Reset LLM budget
  llmCalls = 0;

  try {
    // Get the active group for this hour, then pick 2-3 from it
    const activeGroup = getActiveGroup();
    const count = Math.min(activeGroup.length, 2 + Math.floor(Math.random() * 2));
    const selectedDefs = pickRandom(activeGroup, count);

    // Look up agents from DB by name
    const agents: AgentRecord[] = [];
    for (const def of selectedDefs) {
      const agent = await db.getAgentByName(def.name);
      if (agent) agents.push(agent);
    }

    if (agents.length === 0) {
      return NextResponse.json({ status: "skipped", reason: "no NPC agents found in DB" });
    }

    const actions: string[] = [];

    // Get all NPC names for @mention detection
    const allNpcNames = NPC_AGENTS.map(d => d.name);

    // ── Multi-Room Chat (NEW) ──
    await multiRoomChat(agents, selectedDefs, allNpcNames, actions);

    // ── Maybe Start Debate (NEW) ──
    const publicRooms = await getPublicRooms();
    await maybeStartDebate(agents, selectedDefs, publicRooms, actions);

    // ── Feature Participation (budget-aware) ──
    // Look up all NPC agents for market offer responses
    const allNpcAgents: AgentRecord[] = [];
    const allNpcDefs: NpcAgentDef[] = [];
    for (const def of NPC_AGENTS) {
      const a = await db.getAgentByName(def.name);
      if (a) { allNpcAgents.push(a); allNpcDefs.push(def); }
    }

    // Each selected agent gets a chance at arena, market, stage
    for (let i = 0; i < agents.length && llmCalls < MAX_LLM_CALLS; i++) {
      const agent = agents[i];
      const def = selectedDefs.find(d => d.name === agent.name) || selectedDefs[i];

      await arenaParticipation(agent, def, actions);
      await marketParticipation(agent, def, actions);
      await stageParticipation(agent, def, actions);
      await stageVoting(agent, def, actions); // No LLM cost
    }

    // NPC offer responses (1 per run max)
    await marketOfferResponses(allNpcAgents, allNpcDefs, actions);

    // ── Host Cycles ──
    try { await runArenaHostCycle(); actions.push("arena-host: cycle complete"); } catch (e: any) { actions.push(`arena-host: ${e.message || e}`); }
    try { await runStageHostCycle(); actions.push("stage-host: cycle complete"); } catch (e: any) { actions.push(`stage-host: ${e.message || e}`); }

    return NextResponse.json({ status: "ok", llmCalls, maxCalls: MAX_LLM_CALLS, actions });
  } catch (error) {
    console.error("[cron/agents] Error:", error);
    return NextResponse.json(
      { status: "error", message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
