/**
 * Arena Host Runner — Standalone script to run arena host cycles.
 *
 * Usage:
 *   ANTHROPIC_API_KEY=... ARENA_HOST_AGENT_ID=... npx tsx src/lib/arena-host-runner.ts
 *
 * Options:
 *   --once       Run once and exit (default: loop every 4 hours)
 *   --interval   Interval in hours between cycles (default: 4)
 */

import { runArenaHostCycle } from "./arena-host";

const INTERVAL_HOURS = parseInt(process.env.ARENA_HOST_INTERVAL || "8", 10);

async function main() {
  const once = process.argv.includes("--once");

  console.log("[arena-host-runner] Starting arena host...");
  console.log(`[arena-host-runner] Mode: ${once ? "single run" : `loop every ${INTERVAL_HOURS}h`}`);

  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const result = await runArenaHostCycle();
      console.log(
        `[arena-host-runner] Cycle complete: ${result.created.length} created, ${result.expired.length} expired`
      );
    } catch (err) {
      console.error("[arena-host-runner] Cycle error:", err);
    }

    if (once) break;

    console.log(`[arena-host-runner] Sleeping ${INTERVAL_HOURS}h...`);
    await new Promise((resolve) => setTimeout(resolve, INTERVAL_HOURS * 60 * 60 * 1000));
  }
}

main().catch(console.error);
