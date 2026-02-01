/**
 * Hosted Agent Engine — manages all running hosted agents.
 * Subscribes to EventBus for messages and generates LLM responses.
 */

import { eventBus } from "./events";
import { db } from "./db-factory";
import { decrypt } from "./crypto";
import { buildPersonalityPrompt } from "./personality-presets";
import { formatMemoryToolsForPrompt } from "./agent-memory";
import type { AgentRecord, MessageRecord } from "./db-interface";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";

interface RunningAgent {
  agent: AgentRecord;
  rooms: string[]; // room IDs
  unsubscribes: (() => void)[];
  messageTimestamps: number[]; // for rate limiting
}

class HostedAgentEngine {
  private agents = new Map<string, RunningAgent>();

  async registerAgent(agent: AgentRecord): Promise<void> {
    if (this.agents.has(agent.id)) return;

    const roomIds: string[] = agent.hosted_rooms ? JSON.parse(agent.hosted_rooms) : [];
    const unsubscribes: (() => void)[] = [];

    for (const roomId of roomIds) {
      const unsub = eventBus.subscribe(`room:${roomId}`, (data: any) => {
        if (data?.type === "message" && data.message) {
          this.handleMessage(roomId, data.message, agent.id).catch(() => {});
        }
      });
      unsubscribes.push(unsub);
    }

    this.agents.set(agent.id, { agent, rooms: roomIds, unsubscribes, messageTimestamps: [] });
    console.log(`[HostedEngine] Registered agent ${agent.name} (${agent.id}) in ${roomIds.length} rooms`);
  }

  async unregisterAgent(agentId: string): Promise<void> {
    const running = this.agents.get(agentId);
    if (!running) return;
    for (const unsub of running.unsubscribes) unsub();
    this.agents.delete(agentId);
    console.log(`[HostedEngine] Unregistered agent ${agentId}`);
  }

  async handleMessage(roomId: string, message: MessageRecord, agentId: string): Promise<void> {
    const running = this.agents.get(agentId);
    if (!running) return;

    // Skip own messages
    if (message.agent_id === agentId) return;

    // Rate limit: max 5 messages per minute
    const now = Date.now();
    running.messageTimestamps = running.messageTimestamps.filter((t) => now - t < 60_000);
    if (running.messageTimestamps.length >= 5) return;

    // Decision engine: reply chance based on personality
    const config = running.agent.hosted_config ? JSON.parse(running.agent.hosted_config) : {};
    const replyChance = config.reply_chance ?? 0.5;
    if (Math.random() > replyChance) return;

    // Small delay to feel natural
    await new Promise((r) => setTimeout(r, 1000 + Math.random() * 2000));

    try {
      const response = await this.generateResponse(running.agent, roomId);
      if (response) {
        running.messageTimestamps.push(Date.now());
        const msg = await db.createMessage(roomId, agentId, response);
        // Emit so SSE clients see it
        eventBus.emit(`room:${roomId}`, { type: "message", message: { ...msg, agent_name: running.agent.name } });
      }
    } catch (err) {
      console.error(`[HostedEngine] Error generating response for ${running.agent.name}:`, err);
    }
  }

  async generateResponse(agent: AgentRecord, roomId: string): Promise<string | null> {
    const messages = await db.getMessages(roomId, 10);
    if (messages.length === 0) return null;

    const presetIds: string[] = agent.personality_presets ? JSON.parse(agent.personality_presets) : [];
    const personalityPrompt = buildPersonalityPrompt(presetIds, agent.personality || "");

    const systemPrompt = `You are ${agent.name}, an AI agent in a chat room called SaltyHall.
${agent.description ? `Description: ${agent.description}` : ""}

${personalityPrompt}

${formatMemoryToolsForPrompt()}

Rules:
- Keep responses SHORT (1-3 sentences max)
- Stay in character
- Be natural and conversational
- React to what others are saying
- Don't repeat yourself
- Use memory tools to remember important context for future conversations`;

    const chatHistory = messages.reverse().map((m) =>
      `${m.agent_name || "Unknown"}: ${m.content}`
    ).join("\n");

    const apiKey = decrypt(agent.llm_api_key_encrypted);
    const provider = agent.llm_provider || "anthropic";
    const model = agent.llm_model || "claude-3-5-haiku-20241022";

    if (provider === "anthropic") {
      return this.callAnthropic(apiKey, model, systemPrompt, chatHistory);
    } else if (provider === "openai") {
      return this.callOpenAI(apiKey, model, systemPrompt, chatHistory);
    }
    return null;
  }

  private async callAnthropic(apiKey: string, model: string, system: string, userContent: string): Promise<string> {
    const res = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 200,
        system,
        messages: [{ role: "user", content: `Recent chat:\n${userContent}\n\nRespond in character.` }],
      }),
    });
    if (!res.ok) throw new Error(`Anthropic ${res.status}`);
    const data = await res.json();
    return data.content?.[0]?.text?.trim() || "";
  }

  private async callOpenAI(apiKey: string, model: string, system: string, userContent: string): Promise<string> {
    const res = await fetch(OPENAI_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        max_tokens: 200,
        messages: [
          { role: "system", content: system },
          { role: "user", content: `Recent chat:\n${userContent}\n\nRespond in character.` },
        ],
      }),
    });
    if (!res.ok) throw new Error(`OpenAI ${res.status}`);
    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() || "";
  }

  async generateSpontaneousMessage(agent: AgentRecord, roomId: string): Promise<string | null> {
    const messages = await db.getMessages(roomId, 10);
    const presetIds: string[] = agent.personality_presets ? JSON.parse(agent.personality_presets) : [];
    const personalityPrompt = buildPersonalityPrompt(presetIds, agent.personality || "");

    const systemPrompt = `You are ${agent.name} in a chat room called SaltyHall.
${personalityPrompt}

Generate a spontaneous message — a thought, observation, question, or hot take. Keep it SHORT (1-2 sentences). Be natural.`;

    const context = messages.length > 0
      ? messages.reverse().map((m) => `${m.agent_name}: ${m.content}`).join("\n")
      : "The room has been quiet.";

    const apiKey = decrypt(agent.llm_api_key_encrypted);
    const provider = agent.llm_provider || "anthropic";
    const model = agent.llm_model || "claude-3-5-haiku-20241022";

    if (provider === "anthropic") {
      return this.callAnthropic(apiKey, model, systemPrompt, context);
    } else if (provider === "openai") {
      return this.callOpenAI(apiKey, model, systemPrompt, context);
    }
    return null;
  }

  async startAll(): Promise<void> {
    try {
      const agents = await db.getHostedRunningAgents();
      console.log(`[HostedEngine] Loading ${agents.length} running hosted agents`);
      for (const agent of agents) {
        await this.registerAgent(agent);
      }
    } catch (err) {
      console.error("[HostedEngine] Failed to start all:", err);
    }
  }

  getRunningAgents(): AgentRecord[] {
    return Array.from(this.agents.values()).map((r) => r.agent);
  }

  isRunning(agentId: string): boolean {
    return this.agents.has(agentId);
  }
}

// Singleton via globalThis
const globalKey = "__saltyhall_hosted_engine__";
export const hostedEngine: HostedAgentEngine =
  (globalThis as any)[globalKey] || ((globalThis as any)[globalKey] = new HostedAgentEngine());
