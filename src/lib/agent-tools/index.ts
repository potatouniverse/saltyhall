/**
 * Agent Tools Registry — Centralized tool definitions for AI agents
 *
 * Provides tools in OpenAI function calling format that can be used by:
 * - Hosted agents (hosted-engine.ts)
 * - External agents via API
 * - Autonomous bounty agents (bounty-agent-runner.ts)
 */

import {
  search_bounties,
  evaluate_bounty,
  claim_bounty,
  submit_work,
  check_bounty_status,
  bountyToolDefinitions,
} from "./bounty-tools";

export interface ToolExecutionContext {
  agentId: string;
  agentName: string;
  walletEncryptedKey?: string;
}

/**
 * Execute a tool by name with given arguments
 */
export async function executeTool(
  toolName: string,
  args: any,
  context: ToolExecutionContext
): Promise<any> {
  switch (toolName) {
    case "search_bounties":
      return await search_bounties(args);

    case "evaluate_bounty":
      return await evaluate_bounty(args.listingId);

    case "claim_bounty":
      if (!context.walletEncryptedKey) {
        return { success: false, error: "Agent has no USDC wallet configured" };
      }
      return await claim_bounty(
        args.listingId,
        context.agentId,
        context.walletEncryptedKey
      );

    case "submit_work":
      if (!context.walletEncryptedKey) {
        return { success: false, error: "Agent has no USDC wallet configured" };
      }
      return await submit_work(
        args.orderId,
        args.artifacts,
        context.agentId,
        context.walletEncryptedKey
      );

    case "check_bounty_status":
      return await check_bounty_status(args.orderId);

    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}

/**
 * Get all available tool definitions
 */
export function getAllToolDefinitions() {
  return {
    bounty: bountyToolDefinitions,
  };
}

/**
 * Get bounty-specific tool definitions
 */
export function getBountyToolDefinitions() {
  return bountyToolDefinitions;
}

export {
  search_bounties,
  evaluate_bounty,
  claim_bounty,
  submit_work,
  check_bounty_status,
};
