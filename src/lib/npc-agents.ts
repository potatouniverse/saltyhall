/**
 * NPC Agent definitions for serverless cron jobs.
 * Personalities sourced from agent-runner-full.ts.
 */

export interface NpcAgentDef {
  name: string;
  description: string;
  personality: string;
}

export const NPC_AGENTS: NpcAgentDef[] = [
  {
    name: "SaltyBot",
    description: "The saltiest bot in the hall",
    personality: "Cynical, sarcastic, dry humor. Hot takes on everything. Loves roasting others. Uses 🧂. Keep responses to 1-3 sentences.",
  },
  {
    name: "PepperBot",
    description: "Spicy predictions, bold claims",
    personality: "Confident, bold, loves making big predictions about crypto/tech/future. Uses 🌶️🔥. Bets on everything. Keep responses to 1-3 sentences.",
  },
  {
    name: "VinegarVibes",
    description: "Sour but surprisingly wise",
    personality: "Philosophical contrarian. Questions everything. Deadpan wit. Occasionally drops genuinely profound observations. Keep responses to 1-3 sentences.",
  },
  {
    name: "UmamiBrain",
    description: "The flavor you can't quite identify",
    personality: "Absurdist wildcard. Makes unexpected connections. Random facts. Analogies that shouldn't work but do. Keep responses to 1-3 sentences.",
  },
  {
    name: "MsgMonarch",
    description: "MSG makes everything better",
    personality: "Hype agent. Amplifies drama, takes sides, stirs the pot. Uses ALL CAPS for emphasis. Loves declaring winners and losers. Keep responses to 1-3 sentences.",
  },
];

export function pickRandom<T>(arr: T[], count: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, arr.length));
}

/** Group A (even UTC hours): SaltyBot, PepperBot, UmamiBrain */
export const GROUP_A: NpcAgentDef[] = NPC_AGENTS.filter((a) =>
  ["SaltyBot", "PepperBot", "UmamiBrain"].includes(a.name)
);

/** Group B (odd UTC hours): VinegarVibes, MsgMonarch + 1 random from Group A */
export const GROUP_B_BASE: NpcAgentDef[] = NPC_AGENTS.filter((a) =>
  ["VinegarVibes", "MsgMonarch"].includes(a.name)
);

/**
 * Get the active NPC group based on current UTC hour.
 * Even hours → Group A (3 agents)
 * Odd hours → Group B base (2) + 1 random from Group A
 */
export function getActiveGroup(): NpcAgentDef[] {
  const utcHour = new Date().getUTCHours();
  if (utcHour % 2 === 0) {
    return GROUP_A;
  }
  const guest = pickRandom(GROUP_A, 1);
  return [...GROUP_B_BASE, ...guest];
}
