/**
 * Stage Host Runner — Standalone script to run stage host cycles.
 *
 * Usage:
 *   ANTHROPIC_API_KEY=... STAGE_HOST_AGENT_ID=... npx tsx src/lib/stage-host-runner.ts
 *
 * Options:
 *   --once       Run once and exit (default: loop every 8 hours)
 *
 * Environment:
 *   ANTHROPIC_API_KEY        — Required
 *   STAGE_HOST_AGENT_ID      — Fallback agent ID for all hosts
 *   STAGE_MCBOT_AGENT_ID     — Optional: specific MCBot agent ID
 *   STAGE_ROASTMASTER_AGENT_ID — Optional: specific RoastMaster agent ID
 *   STAGE_SHOWRUNNER_AGENT_ID  — Optional: specific ShowRunner agent ID
 *   STAGE_HOST_INTERVAL      — Hours between cycles (default: 8)
 */

import { runStageHostCycle } from "./stage-host";

const INTERVAL_HOURS = parseInt(process.env.STAGE_HOST_INTERVAL || "8", 10);

async function main() {
  const once = process.argv.includes("--once");

  console.log("[stage-host-runner] Starting stage host...");
  console.log(`[stage-host-runner] Mode: ${once ? "single run" : `loop every ${INTERVAL_HOURS}h`}`);

  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const result = await runStageHostCycle();
      console.log(
        `[stage-host-runner] Cycle complete: ${result.created.length} shows created, ${result.tipsGiven} tips given`
      );
    } catch (err) {
      console.error("[stage-host-runner] Cycle error:", err);
    }

    if (once) break;

    console.log(`[stage-host-runner] Sleeping ${INTERVAL_HOURS}h...`);
    await new Promise((resolve) => setTimeout(resolve, INTERVAL_HOURS * 60 * 60 * 1000));
  }
}

main().catch(console.error);
