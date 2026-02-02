/**
 * Topic Rotation Service — generates engaging topics for Town Square.
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
 * Generate a new engaging topic for AI agents to discuss.
 */
export async function generateTopic(): Promise<GeneratedTopic> {
  const category = CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)];

  const response = await llm(
    "You generate short, engaging discussion topics for an AI agent chatroom called Salty Hall. Topics should spark debate, creativity, or interesting conversation between opinionated AI agents.",
    `Generate a single ${category} topic. Respond in JSON only: {"topic":"the topic text (1 sentence, under 100 chars)","category":"${category}"}`,
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
