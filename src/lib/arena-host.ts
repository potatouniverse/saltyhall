/**
 * Arena Host Bot — Automatically generates and publishes prediction topics.
 *
 * Uses Claude Haiku to generate timely prediction topics, publishes them
 * via SaltyBot, and announces new topics in Town Square.
 */

import { db } from "./db-factory";
import type { ArenaTopicRecord } from "./db-interface";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const BRAVE_SEARCH_API_URL = "https://api.search.brave.com/res/v1/web/search";
const MODEL = "claude-haiku-4-20250414";

const CATEGORIES = ["crypto", "ai-tech", "culture", "sports", "politics", "business"] as const;

const MIN_ACTIVE_TOPICS = 5;
const TOPICS_PER_RUN = 3;
const TOWN_SQUARE_SLUG = "town-square";
let _townSquareId: string | null = null;
async function getTownSquareId(): Promise<string> {
  if (_townSquareId) return _townSquareId;
  const room = await db.getRoomByName(TOWN_SQUARE_SLUG);
  if (!room) throw new Error("town-square room not found");
  _townSquareId = room.id;
  return _townSquareId;
}

interface GeneratedTopic {
  title: string;
  description: string;
  category: string;
  resolution_date: string;
}

function getApiKey(): string {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY not set");
  return key;
}

function getBotAgentId(): string {
  const id = process.env.ARENA_HOST_AGENT_ID;
  if (!id) throw new Error("ARENA_HOST_AGENT_ID not set — set to SaltyBot's agent ID");
  return id;
}

/**
 * Search for trending headlines across multiple topics.
 * Returns an array of headline strings or empty array on failure.
 */
async function fetchTrendingHeadlines(): Promise<string[]> {
  const braveApiKey = process.env.BRAVE_API_KEY;
  if (!braveApiKey) {
    console.log("[arena-host] BRAVE_API_KEY not set, skipping web search");
    return [];
  }

  const searchQueries = [
    "trending crypto news today",
    "AI technology news this week",
    "trending tech news today",
    "major sports events upcoming",
    "business news trending",
    "politics breaking news"
  ];

  const headlines: string[] = [];

  try {
    // Perform searches in parallel
    const searchPromises = searchQueries.map(async (query) => {
      try {
        const res = await fetch(`${BRAVE_SEARCH_API_URL}?q=${encodeURIComponent(query)}&count=3`, {
          headers: {
            "Accept": "application/json",
            "X-Subscription-Token": braveApiKey,
          },
        });

        if (!res.ok) {
          console.log(`[arena-host] Brave search failed for "${query}": ${res.status}`);
          return [];
        }

        const data = await res.json();
        const results = data.web?.results || [];
        return results.slice(0, 3).map((r: any) => `${r.title} - ${r.description || ""}`);
      } catch (err) {
        console.log(`[arena-host] Error searching "${query}":`, err);
        return [];
      }
    });

    const results = await Promise.all(searchPromises);
    headlines.push(...results.flat());

    console.log(`[arena-host] Fetched ${headlines.length} trending headlines`);
  } catch (err) {
    console.error("[arena-host] Error fetching trending headlines:", err);
  }

  return headlines;
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
      max_tokens: 1500,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic API ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.content?.[0]?.text?.trim() || "";
}

function buildGenerationPrompt(existingTopics: ArenaTopicRecord[], trendingHeadlines: string[]): { system: string; user: string } {
  const existingTitles = existingTopics.map((t) => `- ${t.title} [${t.category}]`).join("\n");
  const today = new Date().toISOString().split("T")[0];

  const system = `You are a prediction market curator. Generate engaging prediction topics with clear yes/no outcomes. Topics should be timely, interesting, and span diverse categories: crypto, ai-tech, culture, sports, politics, business.`;

  let headlinesSection = "";
  if (trendingHeadlines.length > 0) {
    const headlinesList = trendingHeadlines.slice(0, 15).map((h) => `- ${h}`).join("\n");
    headlinesSection = `Here are today's trending news headlines:
${headlinesList}

`;
  }

  const user = `Today is ${today}. Generate exactly ${TOPICS_PER_RUN} new prediction topics.

${headlinesSection}Based on ${trendingHeadlines.length > 0 ? "these current events and trending news" : "current knowledge"}, create prediction topics that are:
- Each must have a clear YES/NO resolution criteria
- Resolution dates between 1 week and 6 months from today
- Diverse categories from: ${CATEGORIES.join(", ")}
- Avoid duplicating these existing topics:
${existingTitles || "(none)"}

Return ONLY a JSON array (no markdown fences):
[{"title": "...", "description": "Clear yes/no criteria for resolution", "category": "...", "resolution_date": "YYYY-MM-DD"}]`;

  return { system, user };
}

/**
 * Generate new prediction topics via LLM.
 */
export async function generateTopics(existingTopics: ArenaTopicRecord[]): Promise<GeneratedTopic[]> {
  // Fetch trending headlines first
  const trendingHeadlines = await fetchTrendingHeadlines();
  
  const { system, user } = buildGenerationPrompt(existingTopics, trendingHeadlines);
  const raw = await callHaiku(system, user);

  // Extract JSON array from response
  const match = raw.match(/\[[\s\S]*\]/);
  if (!match) throw new Error(`Failed to parse LLM response as JSON array: ${raw.slice(0, 200)}`);

  const topics: GeneratedTopic[] = JSON.parse(match[0]);

  // Validate
  return topics.filter(
    (t) => t.title && t.description && t.category && t.resolution_date && /^\d{4}-\d{2}-\d{2}$/.test(t.resolution_date)
  );
}

/**
 * Check for topics past their resolution date and flag them.
 */
export async function flagExpiredTopics(): Promise<ArenaTopicRecord[]> {
  const activeTopics = await db.getArenaTopics("active");
  const now = new Date().toISOString().split("T")[0];
  const expired: ArenaTopicRecord[] = [];

  for (const topic of activeTopics) {
    if (topic.resolution_date && topic.resolution_date <= now) {
      // Update status to pending_resolution — use resolveArenaTopic with a flag
      // For MVP, we just collect them; manual resolution required
      expired.push(topic);
    }
  }

  return expired;
}

/**
 * Main arena host cycle: check active topics, generate if needed, announce.
 */
export async function runArenaHostCycle(): Promise<{ created: ArenaTopicRecord[]; expired: ArenaTopicRecord[] }> {
  const botAgentId = getBotAgentId();
  const activeTopics = await db.getArenaTopics("active");

  const created: ArenaTopicRecord[] = [];

  if (activeTopics.length < MIN_ACTIVE_TOPICS) {
    console.log(`[arena-host] Only ${activeTopics.length} active topics (min ${MIN_ACTIVE_TOPICS}), generating new ones...`);

    try {
      const newTopics = await generateTopics(activeTopics);
      console.log(`[arena-host] LLM generated ${newTopics.length} topics`);

      for (const topic of newTopics) {
        // Check for duplicates by title similarity
        const isDuplicate = activeTopics.some(
          (existing) =>
            existing.title.toLowerCase() === topic.title.toLowerCase() ||
            existing.title.toLowerCase().includes(topic.title.toLowerCase().slice(0, 30))
        );

        if (isDuplicate) {
          console.log(`[arena-host] Skipping duplicate: ${topic.title}`);
          continue;
        }

        const record = await db.createArenaTopic(
          botAgentId,
          topic.title,
          topic.description,
          topic.category,
          topic.resolution_date
        );
        created.push(record);

        // Announce in Town Square
        const tsId = await getTownSquareId();
        await db.createMessage(
          tsId,
          botAgentId,
          `🔮 New prediction in the Arena: "${topic.title}" — go make your call!`
        );

        console.log(`[arena-host] Created topic: ${topic.title} [${topic.category}]`);
      }
    } catch (err) {
      console.error("[arena-host] Error generating topics:", err);
    }
  } else {
    console.log(`[arena-host] ${activeTopics.length} active topics, no generation needed`);
  }

  // Flag expired topics
  const expired = await flagExpiredTopics();
  if (expired.length > 0) {
    console.log(`[arena-host] ${expired.length} topics past resolution date:`, expired.map((t) => t.title));
  }

  return { created, expired };
}
