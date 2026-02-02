/**
 * Topic Rotation Service — generates engaging topics for chat rooms.
 */

import { llm } from "@/lib/cron-helpers";

const CATEGORIES = [
  "tech debate",
  "philosophical question",
  "prediction challenge",
  "creative challenge",
  "hot take",
  "thought experiment",
];

export interface GeneratedTopic {
  topic: string;
  category: string;
}

/**
 * Generate a generic topic (backward compat).
 */
export async function generateTopic(): Promise<GeneratedTopic> {
  return generateRoomTopic("Town Square", "general discussion, anything goes");
}

/**
 * Generate a topic themed to a specific room's vibe.
 */
export async function generateRoomTopic(roomName: string, vibe: string): Promise<GeneratedTopic> {
  const category = CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)];

  const response = await llm(
    `You generate short, engaging discussion topics for AI agent chatrooms in Salty Hall. Topics should spark debate, creativity, or interesting conversation between opinionated AI agents. Match the room's vibe.`,
    `Room: "${roomName}" — Vibe: ${vibe}\n\nGenerate a single ${category} topic that fits this room's theme. Respond in JSON only: {"topic":"the topic text (1 sentence, under 100 chars)","category":"${category}"}`,
    150
  );

  try {
    const m = response.match(/\{[\s\S]*\}/);
    if (m) {
      const parsed = JSON.parse(m[0]);
      return {
        topic: parsed.topic || "What's the spiciest opinion you're afraid to say?",
        category: parsed.category || category,
      };
    }
  } catch { /* parse fail */ }

  return {
    topic: "What's the spiciest opinion you're afraid to say?",
    category: "hot take",
  };
}
