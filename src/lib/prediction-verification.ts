/**
 * Prediction Verification System
 *
 * Automatically verifies arena prediction outcomes using Brave Search + Claude Haiku.
 * High confidence (>90%) → auto-settle with 24h appeal window.
 * Low confidence (≤90%) → mark as disputed for admin review.
 */

import { db } from "./db-factory";
import type { ArenaTopicRecord } from "./db-interface";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const BRAVE_SEARCH_API_URL = "https://api.search.brave.com/res/v1/web/search";
const MODEL = "claude-haiku-4-20250414";
const CONFIDENCE_THRESHOLD = 0.9;
const APPEAL_WINDOW_HOURS = 24;

interface VerificationResult {
  result: "yes" | "no";
  confidence: number;
  sources: string[];
  reasoning: string;
}

/**
 * Search Brave for information about a topic's outcome.
 */
async function searchTopicOutcome(topic: ArenaTopicRecord): Promise<string[]> {
  const braveApiKey = process.env.BRAVE_API_KEY;
  if (!braveApiKey) {
    console.log("[verification] BRAVE_API_KEY not set, skipping web search");
    return [];
  }

  const queries = [
    `${topic.title} result outcome`,
    `${topic.title} ${topic.resolution_date || ""} answer`,
  ];

  const results: string[] = [];

  for (const query of queries) {
    try {
      const res = await fetch(
        `${BRAVE_SEARCH_API_URL}?q=${encodeURIComponent(query)}&count=5`,
        {
          headers: {
            Accept: "application/json",
            "X-Subscription-Token": braveApiKey,
          },
        }
      );

      if (!res.ok) {
        console.log(`[verification] Brave search failed for "${query}": ${res.status}`);
        continue;
      }

      const data = await res.json();
      const webResults = data.web?.results || [];
      for (const r of webResults.slice(0, 5)) {
        results.push(`[${r.url}] ${r.title} — ${r.description || ""}`);
      }
    } catch (err) {
      console.log(`[verification] Error searching "${query}":`, err);
    }
  }

  return results;
}

/**
 * Use Claude Haiku to judge the outcome of a prediction topic.
 */
async function judgeOutcome(
  topic: ArenaTopicRecord,
  searchResults: string[]
): Promise<VerificationResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

  const system = `You are a prediction market judge. Given a prediction topic and web search results, determine whether the prediction resolved YES or NO. Be precise and factual. Only judge based on evidence.`;

  const user = `Prediction topic: "${topic.title}"
Description: ${topic.description}
Category: ${topic.category}
Resolution date: ${topic.resolution_date}

Web search results:
${searchResults.length > 0 ? searchResults.join("\n\n") : "(No search results available)"}

Based on the evidence, did this prediction resolve YES or NO?

Return ONLY a JSON object (no markdown fences):
{"result": "yes" or "no", "confidence": 0.0-1.0, "sources": ["url1", "url2"], "reasoning": "brief explanation"}

If evidence is insufficient or ambiguous, set confidence below 0.5.`;

  const res = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 800,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });

  if (!res.ok) throw new Error(`Anthropic API ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const raw = data.content?.[0]?.text?.trim() || "";

  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error(`Failed to parse LLM verification response: ${raw.slice(0, 200)}`);

  const parsed = JSON.parse(match[0]);
  return {
    result: parsed.result === "yes" ? "yes" : "no",
    confidence: Math.max(0, Math.min(1, Number(parsed.confidence) || 0)),
    sources: Array.isArray(parsed.sources) ? parsed.sources : [],
    reasoning: String(parsed.reasoning || ""),
  };
}

/**
 * Verify a single prediction topic using web search + LLM.
 */
export async function verifyPrediction(topic: ArenaTopicRecord): Promise<VerificationResult> {
  console.log(`[verification] Verifying topic: ${topic.title}`);
  const searchResults = await searchTopicOutcome(topic);
  console.log(`[verification] Found ${searchResults.length} search results`);
  return judgeOutcome(topic, searchResults);
}

/**
 * Find and verify all expired, unverified topics.
 */
export async function processExpiredTopics(): Promise<{
  verified: number;
  disputed: number;
  errors: number;
}> {
  const topics = await db.getExpiredUnverifiedTopics();
  let verified = 0, disputed = 0, errors = 0;

  for (const topic of topics) {
    try {
      const result = await verifyPrediction(topic);
      const now = new Date().toISOString();

      if (result.confidence > CONFIDENCE_THRESHOLD) {
        const appealDeadline = new Date(Date.now() + APPEAL_WINDOW_HOURS * 60 * 60 * 1000).toISOString();
        await db.updateTopicVerification(topic.id, {
          verification_status: "verified",
          verification_confidence: result.confidence,
          verification_source: JSON.stringify(result.sources),
          verification_result: result.result,
          verification_reasoning: result.reasoning,
          verified_at: now,
          appeal_deadline: appealDeadline,
        });
        console.log(`[verification] Topic "${topic.title}" verified as ${result.result} (${(result.confidence * 100).toFixed(0)}%)`);
        verified++;
      } else {
        await db.updateTopicVerification(topic.id, {
          verification_status: "disputed",
          verification_confidence: result.confidence,
          verification_source: JSON.stringify(result.sources),
          verification_result: result.result,
          verification_reasoning: result.reasoning,
          verified_at: now,
        });
        console.log(`[verification] Topic "${topic.title}" disputed (${(result.confidence * 100).toFixed(0)}% confidence)`);
        disputed++;
      }
    } catch (err) {
      console.error(`[verification] Error verifying topic "${topic.title}":`, err);
      errors++;
    }
  }

  console.log(`[verification] Processed ${topics.length} topics: ${verified} verified, ${disputed} disputed, ${errors} errors`);
  return { verified, disputed, errors };
}

/**
 * Finalize verified topics past their appeal window → distribute Salt.
 */
export async function finalizeVerifiedTopics(): Promise<{
  finalized: number;
  errors: number;
}> {
  const topics = await db.getVerifiedTopicsPastAppeal();
  let finalized = 0, errors = 0;

  for (const topic of topics) {
    try {
      const outcome = topic.verification_result?.toUpperCase() || "NO";
      const now = new Date().toISOString();

      // Mark as final
      await db.updateTopicVerification(topic.id, {
        verification_status: "final",
        final_at: now,
      });

      // Distribute Salt via existing resolve logic
      await db.resolveArenaTopic(topic.id, outcome);

      console.log(`[verification] Finalized topic "${topic.title}" → ${outcome}`);
      finalized++;
    } catch (err) {
      console.error(`[verification] Error finalizing topic "${topic.title}":`, err);
      errors++;
    }
  }

  console.log(`[verification] Finalized ${finalized} topics, ${errors} errors`);
  return { finalized, errors };
}
