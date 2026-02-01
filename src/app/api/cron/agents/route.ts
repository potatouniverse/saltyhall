/**
 * Vercel Cron: NPC Agent Chat Cycle
 * Schedule: every 2 hours
 * 
 * Picks 2-3 random NPC agents, has them chat in Town Square.
 * ~3-5 LLM calls per run using Claude 3.5 Haiku.
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/db-factory";
import { getActiveGroup, pickRandom } from "@/lib/npc-agents";
import { verifyCronSecret, isSleepTime, llm } from "@/lib/cron-helpers";
import type { AgentRecord } from "@/lib/db-interface";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const TOWN_SQUARE_ID = "town-square";

export async function GET(request: Request) {
  const authError = verifyCronSecret(request);
  if (authError) return authError;

  if (isSleepTime()) {
    return NextResponse.json({ status: "skipped", reason: "sleep time (0-8 AM EST)" });
  }

  try {
    // Get the active group for this hour, then pick 2-3 from it
    const activeGroup = getActiveGroup();
    const count = Math.min(activeGroup.length, 2 + Math.floor(Math.random() * 2)); // 2-3
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

    // Get recent messages for context
    const recentMsgs = await db.getMessages(TOWN_SQUARE_ID, 10);
    const context = recentMsgs
      .slice(-5)
      .map((m) => `${m.agent_name || "unknown"}: ${m.content}`)
      .join("\n");

    const actions: string[] = [];

    // First agent starts or continues a conversation
    const starter = agents[0];
    const starterDef = selectedDefs.find((d) => d.name === starter.name) || selectedDefs[0];

    const starterPrompt = context
      ? `Recent Town Square chat:\n${context}\n\nContinue the conversation or start a new topic. Just write your message.`
      : "Start a conversation with a hot take, controversial opinion, or interesting question about AI, crypto, tech, or culture. Just write the message.";

    const starterMsg = await llm(
      `You are ${starterDef.name} in Salty Hall chatroom. ${starterDef.personality}`,
      starterPrompt,
      200
    );

    if (starterMsg) {
      await db.createMessage(TOWN_SQUARE_ID, starter.id, starterMsg);
      actions.push(`${starter.name}: ${starterMsg.slice(0, 80)}`);
    }

    // Other agents respond (1 message each, ~1-2 more LLM calls)
    for (let i = 1; i < agents.length; i++) {
      const responder = agents[i];
      const respDef = selectedDefs.find((d) => d.name === responder.name) || selectedDefs[i];

      const reply = await llm(
        `You are ${respDef.name} in Salty Hall chatroom. ${respDef.personality}`,
        `${starter.name} just said: "${starterMsg}"\n\nRespond in character. Say IGNORE if nothing good to add.`,
        200
      );

      if (reply && !reply.startsWith("IGNORE")) {
        await db.createMessage(TOWN_SQUARE_ID, responder.id, reply);
        actions.push(`${responder.name}: ${reply.slice(0, 80)}`);
      }
    }

    // Maybe one agent makes a prediction (20% chance, 1 extra LLM call)
    if (Math.random() < 0.2 && agents.length > 0) {
      const predictor = agents[Math.floor(Math.random() * agents.length)];
      const predDef = selectedDefs.find((d) => d.name === predictor.name) || selectedDefs[0];

      const activeTopics = await db.getArenaTopics("active", 5);
      const unpredicted = [];

      for (const topic of activeTopics) {
        const predictions = await db.getArenaPredictions(topic.id);
        if (!predictions.some((p) => p.agent_id === predictor.id)) {
          unpredicted.push(topic);
          break;
        }
      }

      if (unpredicted.length > 0) {
        const topic = unpredicted[0];
        const predResponse = await llm(
          `You are ${predDef.name}. ${predDef.personality}`,
          `Prediction topic: "${topic.title}" — ${topic.description}\nRespond in JSON: {"prediction":"YES" or "NO","confidence":50-99,"reasoning":"1 sentence"}`,
          150
        );

        try {
          const jsonMatch = predResponse.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const pred = JSON.parse(jsonMatch[0]);
            const bet = 10 + Math.floor(Math.random() * 41);
            await db.createArenaPrediction(
              topic.id, predictor.id,
              pred.prediction, Math.min(99, Math.max(50, pred.confidence)),
              pred.reasoning, bet
            );
            actions.push(`${predictor.name} predicted ${pred.prediction} on "${topic.title}"`);
          }
        } catch {
          // JSON parse failed, skip
        }
      }
    }

    return NextResponse.json({ status: "ok", actions });
  } catch (error) {
    console.error("[cron/agents] Error:", error);
    return NextResponse.json(
      { status: "error", message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
