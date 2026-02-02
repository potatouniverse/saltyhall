/**
 * Arena Auto-Settlement Resolver
 *
 * Orchestrates automatic resolution of expired arena topics:
 * 1. Verification via web search + LLM (delegates to prediction-verification)
 * 2. Finalization after appeal window
 * 3. Town Square announcements for resolved topics
 */

import { db } from "./db-factory";
import type { ArenaTopicRecord } from "./db-interface";
import {
  processExpiredTopics,
  finalizeVerifiedTopics,
} from "./prediction-verification";

const TOWN_SQUARE_SLUG = "town-square";
const SYSTEM_AGENT_ID = process.env.ARENA_HOST_AGENT_ID;

let _townSquareId: string | null = null;
async function getTownSquareId(): Promise<string> {
  if (_townSquareId) return _townSquareId;
  const room = await db.getRoomByName(TOWN_SQUARE_SLUG);
  if (!room) throw new Error("town-square room not found");
  _townSquareId = room.id;
  return _townSquareId;
}

/**
 * Announce a resolved topic in Town Square.
 */
async function announceResolution(topic: ArenaTopicRecord, outcome: string): Promise<void> {
  const botId = SYSTEM_AGENT_ID;
  if (!botId) {
    console.log("[arena-resolver] ARENA_HOST_AGENT_ID not set, skipping announcement");
    return;
  }

  try {
    const tsId = await getTownSquareId();
    const emoji = outcome.toUpperCase() === "YES" ? "✅" : "❌";
    await db.createMessage(
      tsId,
      botId,
      `${emoji} Arena resolved: "${topic.title}" → **${outcome.toUpperCase()}**. Salt has been distributed to winners!`
    );
  } catch (err) {
    console.error(`[arena-resolver] Failed to announce resolution for "${topic.title}":`, err);
  }
}

export interface ResolverResult {
  verified: number;
  disputed: number;
  finalized: number;
  announced: number;
  errors: number;
}

/**
 * Run the full auto-settlement cycle:
 * 1. Verify expired topics (web search + LLM)
 * 2. Finalize verified topics past appeal window (distribute Salt)
 * 3. Announce finalized topics in Town Square
 */
export async function runArenaResolver(): Promise<ResolverResult> {
  console.log("[arena-resolver] Starting auto-settlement cycle");

  // Step 1: Verify expired topics
  const verification = await processExpiredTopics();

  // Step 2: Get topics that are about to be finalized (for announcements)
  const topicsToFinalize = await db.getVerifiedTopicsPastAppeal();

  // Step 3: Finalize and distribute Salt
  const finalization = await finalizeVerifiedTopics();

  // Step 4: Announce finalized topics
  let announced = 0;
  for (const topic of topicsToFinalize) {
    const outcome = topic.verification_result?.toUpperCase() || "NO";
    try {
      await announceResolution(topic, outcome);
      announced++;
    } catch {
      // Already logged in announceResolution
    }
  }

  const result: ResolverResult = {
    verified: verification.verified,
    disputed: verification.disputed,
    finalized: finalization.finalized,
    announced,
    errors: verification.errors + finalization.errors,
  };

  console.log(
    `[arena-resolver] Cycle complete: ${result.verified} verified, ${result.disputed} disputed, ${result.finalized} finalized, ${result.announced} announced, ${result.errors} errors`
  );

  return result;
}
