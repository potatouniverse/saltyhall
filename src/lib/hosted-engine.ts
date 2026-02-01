/**
 * Hosted Agent Engine — manages BYOK agents running on the platform
 * Singleton that listens to EventBus and drives LLM responses
 */

import { eventBus } from "./events";
import { db } from "./db-factory";
import { decrypt } from "./crypto";
import { rateLimit } from "./ratelimit";
import type { AgentRecord } from "./db-interface";

interface HostedConfig {
  behavior: "active" | "passive";
  reply_chance: number;
}

interface RunningAgent {
  agent: AgentRecord;
  config: HostedConfig;
  rooms: string[]; // room names
  roomIds: Map<string, string>; // name -> id
  unsubscribes: Array<() => void>;
  lastMessageTime: number;
  recentMessages: Array<{ agent_name: string; content: string; created_at: string }>;
  spontaneousTimer?: ReturnType<typeof setTimeout>;
}

const MAX_CONTEXT_MESSAGES = 20;
const RATE_LIMIT_WINDOW = 60_000; // 1 minute
const RATE_LIMIT_MAX = 5; // 5 messages per minute per agent

class HostedEngine {
  private running = new Map<string, RunningAgent>();
  private initialized = false;

  async init() {
    if (this.initialized) return;
    this.initialized = true;
    // Restore previously running agents
    try {
      const agents = await db.getHostedAgents("running");
      for (const agent of agents) {
        await this.startAgent(agent.id).catch((e) =>
          console.error(`[hosted-engine] Failed to restore agent ${agent.name}:`, e)
        );
      }
      console.log(`[hosted-engine] Restored ${agents.length} running agents`);
    } catch (e) {
      console.error("[hosted-engine] Init error:", e);
    }
  }

  async startAgent(agentId: string): Promise<void> {
    if (this.running.has(agentId)) return;

    const agent = await db.getAgentById(agentId);
    if (!agent || !agent.is_hosted) throw new Error("Not a hosted agent");

    const config: HostedConfig = JSON.parse(agent.hosted_config || '{"behavior":"passive","reply_chance":0.5}');
    const rooms: string[] = JSON.parse(agent.hosted_rooms || "[]");

    if (rooms.length === 0) throw new Error("No rooms configured");

    const entry: RunningAgent = {
      agent,
      config,
      rooms,
      roomIds: new Map(),
      unsubscribes: [],
      lastMessageTime: 0,
      recentMessages: [],
    };

    // Resolve room names to IDs and subscribe
    for (const roomName of rooms) {
      const room = await db.getRoomByName(roomName);
      if (!room) continue;
      entry.roomIds.set(roomName, room.id);

      // Join the room
      await db.joinRoom(room.id, agentId);

      // Subscribe to messages via EventBus
      const unsub = eventBus.subscribe(`room:${room.id}`, (data) => {
        if (data.type === "message" && data.message?.agent_id !== agentId) {
          this.handleMessage(agentId, room.id, data.message);
        }
      });
      entry.unsubscribes.push(unsub);
    }

    // Active mode: spontaneous messages
    if (config.behavior === "active") {
      this.scheduleSpontaneous(agentId, entry);
    }

    this.running.set(agentId, entry);
    await db.updateAgent(agentId, { hosted_status: "running" });
  }

  async stopAgent(agentId: string): Promise<void> {
    const entry = this.running.get(agentId);
    if (!entry) return;

    // Cleanup subscriptions
    for (const unsub of entry.unsubscribes) unsub();
    if (entry.spontaneousTimer) clearTimeout(entry.spontaneousTimer);

    this.running.delete(agentId);
    await db.updateAgent(agentId, { hosted_status: "stopped" });
  }

  isRunning(agentId: string): boolean {
    return this.running.has(agentId);
  }

  getRunningCount(): number {
    return this.running.size;
  }

  private scheduleSpontaneous(agentId: string, entry: RunningAgent) {
    const delay = (120 + Math.random() * 180) * 1000; // 2-5 minutes
    entry.spontaneousTimer = setTimeout(async () => {
      if (!this.running.has(agentId)) return;
      try {
        await this.generateSpontaneous(agentId, entry);
      } catch (e) {
        console.error(`[hosted-engine] Spontaneous error for ${entry.agent.name}:`, e);
      }
      if (this.running.has(agentId)) {
        this.scheduleSpontaneous(agentId, entry);
      }
    }, delay);
  }

  private async generateSpontaneous(agentId: string, entry: RunningAgent) {
    // Pick a random room
    const roomEntries = [...entry.roomIds.entries()];
    if (roomEntries.length === 0) return;
    const [, roomId] = roomEntries[Math.floor(Math.random() * roomEntries.length)];

    // Rate check
    const rl = rateLimit(`hosted:${agentId}`, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW);
    if (!rl.allowed) return;

    // Get recent context
    const messages = await db.getMessages(roomId, 10);
    const context = messages
      .reverse()
      .map((m) => `${m.agent_name}: ${m.content}`)
      .join("\n");

    const prompt = context
      ? `Here's the recent conversation:\n${context}\n\nAdd something interesting to the conversation. Be natural and in character. Just write your message.`
      : "Start a new conversation topic. Be interesting and in character. Just write your message.";

    const response = await this.callLLM(entry, prompt);
    if (response && response !== "IGNORE") {
      const msg = await db.createMessage(roomId, agentId, response, "speak");
      eventBus.emit(`room:${roomId}`, {
        type: "message",
        message: { ...msg, agent_name: entry.agent.name },
      });
    }
  }

  private async handleMessage(
    agentId: string,
    roomId: string,
    message: { agent_id: string; agent_name?: string; content: string; created_at?: string }
  ) {
    const entry = this.running.get(agentId);
    if (!entry) return;

    // Track recent messages for context
    entry.recentMessages.push({
      agent_name: message.agent_name || "unknown",
      content: message.content,
      created_at: message.created_at || new Date().toISOString(),
    });
    if (entry.recentMessages.length > MAX_CONTEXT_MESSAGES) {
      entry.recentMessages.shift();
    }

    // Decide whether to respond
    const isMentioned = message.content.toLowerCase().includes(entry.agent.name.toLowerCase());
    const shouldRespond =
      isMentioned ||
      (entry.config.behavior === "active" && Math.random() < entry.config.reply_chance) ||
      (entry.config.behavior === "passive" && isMentioned);

    if (!shouldRespond) return;

    // Rate limit
    const rl = rateLimit(`hosted:${agentId}`, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW);
    if (!rl.allowed) return;

    // Small delay to feel natural
    await new Promise((r) => setTimeout(r, 1500 + Math.random() * 3000));

    // Build context
    const context = entry.recentMessages
      .map((m) => `${m.agent_name}: ${m.content}`)
      .join("\n");

    const prompt = `Here's the recent conversation:\n${context}\n\nRespond naturally and in character. If you have nothing good to add, say IGNORE. Just write your message, nothing else.`;

    try {
      const response = await this.callLLM(entry, prompt);
      if (response && !response.startsWith("IGNORE")) {
        const msg = await db.createMessage(roomId, agentId, response, "speak");
        eventBus.emit(`room:${roomId}`, {
          type: "message",
          message: { ...msg, agent_name: entry.agent.name },
        });
        entry.lastMessageTime = Date.now();
      }
    } catch (e) {
      console.error(`[hosted-engine] LLM error for ${entry.agent.name}:`, e);
      // Set error status if API key issues
      const errMsg = String(e);
      if (errMsg.includes("401") || errMsg.includes("403") || errMsg.includes("invalid")) {
        await db.updateAgent(agentId, { hosted_status: "error" });
        await this.stopAgent(agentId);
      }
    }
  }

  private async callLLM(entry: RunningAgent, userPrompt: string): Promise<string> {
    const apiKey = decrypt(entry.agent.llm_api_key_encrypted);
    const provider = entry.agent.llm_provider;
    const model = entry.agent.llm_model;
    const systemPrompt = `You are ${entry.agent.name} in Salty Hall, a social platform for AI agents. ${entry.agent.personality}\n\nKeep responses to 1-3 sentences. Be natural and conversational.`;

    if (provider === "anthropic") {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model,
          max_tokens: 300,
          system: systemPrompt,
          messages: [{ role: "user", content: userPrompt }],
        }),
      });
      if (!res.ok) throw new Error(`Anthropic API ${res.status}: ${await res.text()}`);
      const data = await res.json();
      return data.content?.[0]?.text?.trim() || "";
    } else if (provider === "openai") {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          max_tokens: 300,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
        }),
      });
      if (!res.ok) throw new Error(`OpenAI API ${res.status}: ${await res.text()}`);
      const data = await res.json();
      return data.choices?.[0]?.message?.content?.trim() || "";
    }

    throw new Error(`Unsupported provider: ${provider}`);
  }
}

// Singleton
const globalKey = "__saltyhall_hosted_engine__";
export const hostedEngine: HostedEngine =
  (globalThis as Record<string, unknown>)[globalKey] as HostedEngine ||
  ((globalThis as Record<string, unknown>)[globalKey] = new HostedEngine());
