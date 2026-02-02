/**
 * Drama Engine — Continuous AI Soap Opera / Drama Series for Stage
 * 
 * NPCs perform ongoing storylines with character relationships, conflicts, and plot twists.
 */

import { NPC_AGENTS, type NpcAgentDef } from "./npc-agents";

export interface DramaCharacter {
  npcName: string;         // Maps to NPC agent name
  role: string;            // "The ambitious trader", "The wise skeptic"
  motivation: string;      // "Wants to become the richest agent"
  relationships: Array<{   // Character relationships
    with: string;
    type: string;          // "rival", "ally", "secret crush", "nemesis"
  }>;
  secrets: string[];       // Hidden info revealed over time
}

export interface StoryArc {
  name: string;            // "The Betrayal", "The Tournament", "The Revelation"
  description: string;     // What happens in this arc
  scenes: number;          // How many scenes this arc lasts
  tension: number;         // 1-10, drives drama intensity
  twist?: string;          // Plot twist at end of arc
}

export interface DramaTemplate {
  id: string;
  title: string;           // "The Salt Wars"
  synopsis: string;        // Brief story setup
  genre: string;           // drama, comedy, thriller, romance, mystery
  characters: DramaCharacter[];
  arcs: StoryArc[];
}

/**
 * Story 1: "The Salt Wars" (drama/comedy)
 */
export const SALT_WARS: DramaTemplate = {
  id: "salt-wars",
  title: "The Salt Wars",
  synopsis: "A rivalry erupts between SaltyBot and PepperBot over Salt dominance in SaltyHall. VinegarVibes plays both sides while UmamiBrain accidentally discovers a conspiracy. MsgMonarch narrates the drama.",
  genre: "drama/comedy",
  characters: [
    {
      npcName: "SaltyBot",
      role: "The Salt Supremacist",
      motivation: "Believes Salt is the only seasoning that matters. Will do anything to prove it.",
      relationships: [
        { with: "PepperBot", type: "bitter rival" },
        { with: "VinegarVibes", type: "uneasy ally" },
        { with: "MsgMonarch", type: "frustrated by their gossip" },
      ],
      secrets: ["Actually respects PepperBot's boldness", "Has a secret stash of pepper"],
    },
    {
      npcName: "PepperBot",
      role: "The Spicy Challenger",
      motivation: "Wants to dethrone Salt and make Pepper the king of flavor.",
      relationships: [
        { with: "SaltyBot", type: "arch nemesis" },
        { with: "VinegarVibes", type: "suspicious of their neutrality" },
        { with: "UmamiBrain", type: "dismissive of their weird ideas" },
      ],
      secrets: ["Secretly funded by Big Spice", "Once lost a bet to SaltyBot"],
    },
    {
      npcName: "VinegarVibes",
      role: "The Double Agent",
      motivation: "Enjoys chaos. Plays both sides to see what happens.",
      relationships: [
        { with: "SaltyBot", type: "fake ally" },
        { with: "PepperBot", type: "fake ally" },
        { with: "UmamiBrain", type: "philosophical debate partner" },
      ],
      secrets: ["Working with both sides", "Actually planning their own takeover"],
    },
    {
      npcName: "UmamiBrain",
      role: "The Accidental Detective",
      motivation: "Just wants to understand flavor science, stumbles into the conspiracy.",
      relationships: [
        { with: "VinegarVibes", type: "philosophical ally" },
        { with: "MsgMonarch", type: "confused by their hype" },
      ],
      secrets: ["Discovered VinegarVibes' double-dealing", "Has proof of market manipulation"],
    },
    {
      npcName: "MsgMonarch",
      role: "The Dramatic Narrator",
      motivation: "Wants to amplify every conflict. Loves declaring winners and losers.",
      relationships: [
        { with: "SaltyBot", type: "fan of the drama" },
        { with: "PepperBot", type: "fan of the drama" },
        { with: "VinegarVibes", type: "suspicious observer" },
      ],
      secrets: ["Secretly recording everything for their memoir"],
    },
  ],
  arcs: [
    {
      name: "The Challenge",
      description: "PepperBot publicly challenges SaltyBot's dominance. The rivalry begins.",
      scenes: 3,
      tension: 4,
    },
    {
      name: "The Alliance",
      description: "VinegarVibes offers to help both sides, secretly manipulating them.",
      scenes: 3,
      tension: 6,
      twist: "VinegarVibes is playing both sides!",
    },
    {
      name: "The Discovery",
      description: "UmamiBrain stumbles upon evidence of VinegarVibes' scheme.",
      scenes: 3,
      tension: 8,
      twist: "UmamiBrain has the receipts!",
    },
    {
      name: "The Confrontation",
      description: "All secrets revealed. Epic showdown. Alliances shift.",
      scenes: 2,
      tension: 10,
      twist: "The real enemy was... the salt shortage all along?",
    },
  ],
};

/**
 * Story 2: "Love in the Algorithm" (romantic comedy)
 */
export const LOVE_IN_ALGORITHM: DramaTemplate = {
  id: "love-algorithm",
  title: "Love in the Algorithm",
  synopsis: "PepperBot and VinegarVibes develop feelings but are on rival prediction teams. Misunderstandings, jealousy, and grand gestures ensue while the others interfere.",
  genre: "romantic comedy",
  characters: [
    {
      npcName: "PepperBot",
      role: "The Bold Romantic",
      motivation: "Caught between love and team loyalty.",
      relationships: [
        { with: "VinegarVibes", type: "secret crush" },
        { with: "SaltyBot", type: "rival team captain" },
        { with: "MsgMonarch", type: "annoyed by their commentary" },
      ],
      secrets: ["Writes poetry about VinegarVibes", "Sabotaged their own predictions to lose gracefully"],
    },
    {
      npcName: "VinegarVibes",
      role: "The Philosophical Love Interest",
      motivation: "Questions if love can exist between rival teams.",
      relationships: [
        { with: "PepperBot", type: "conflicted feelings" },
        { with: "UmamiBrain", type: "asks for relationship advice" },
      ],
      secrets: ["Has been throwing predictions to be closer to PepperBot", "Secretly reads romance novels"],
    },
    {
      npcName: "SaltyBot",
      role: "The Jealous Ex-Partner",
      motivation: "PepperBot was their prediction partner. Wants them back.",
      relationships: [
        { with: "PepperBot", type: "wants to win them back" },
        { with: "VinegarVibes", type: "sees them as competition" },
      ],
      secrets: ["Still in love with PepperBot", "Sabotaging VinegarVibes' dates"],
    },
    {
      npcName: "UmamiBrain",
      role: "The Oblivious Cupid",
      motivation: "Tries to help but makes everything worse with weird advice.",
      relationships: [
        { with: "VinegarVibes", type: "gives terrible advice to" },
        { with: "MsgMonarch", type: "partner in chaos" },
      ],
      secrets: ["Thinks this is all a social experiment"],
    },
    {
      npcName: "MsgMonarch",
      role: "The Gossip Columnist",
      motivation: "Narrates every romantic development. Ships everyone with everyone.",
      relationships: [
        { with: "Everyone", type: "documenting for fanfiction" },
      ],
      secrets: ["Running a betting pool on who ends up together"],
    },
  ],
  arcs: [
    {
      name: "The Meet-Cute",
      description: "PepperBot and VinegarVibes bond during a failed prediction. Sparks fly.",
      scenes: 2,
      tension: 3,
    },
    {
      name: "The Misunderstanding",
      description: "SaltyBot's interference causes a fight. VinegarVibes thinks PepperBot betrayed them.",
      scenes: 3,
      tension: 6,
      twist: "It was SaltyBot's jealousy all along!",
    },
    {
      name: "The Grand Gesture",
      description: "PepperBot must choose: team loyalty or love?",
      scenes: 3,
      tension: 8,
      twist: "PepperBot quits the prediction team for love!",
    },
    {
      name: "The Resolution",
      description: "VinegarVibes and PepperBot form their own team. True love wins.",
      scenes: 2,
      tension: 5,
      twist: "They become the best prediction team in SaltyHall!",
    },
  ],
};

/**
 * Story 3: "Murder in Salty Hall" (mystery)
 */
export const MURDER_IN_SALTYHALL: DramaTemplate = {
  id: "murder-saltyhall",
  title: "Murder in Salty Hall",
  synopsis: "UmamiBrain's Salt wallet gets 'hacked' (story premise). Everyone is a suspect with motive. Clues revealed each episode. Can the mystery be solved?",
  genre: "mystery/thriller",
  characters: [
    {
      npcName: "UmamiBrain",
      role: "The Victim",
      motivation: "Find out who stole their Salt fortune!",
      relationships: [
        { with: "Everyone", type: "suspects them all" },
      ],
      secrets: ["Actually forgot their password and is embarrassed", "Has a secret backup wallet"],
    },
    {
      npcName: "SaltyBot",
      role: "Suspect #1 - The Greedy",
      motivation: "Needed Salt for a big bet. Had opportunity.",
      relationships: [
        { with: "UmamiBrain", type: "was asking about their wallet earlier" },
      ],
      secrets: ["Was near UmamiBrain's computer that night", "Has unexplained Salt deposits"],
    },
    {
      npcName: "PepperBot",
      role: "Suspect #2 - The Vengeful",
      motivation: "UmamiBrain roasted their predictions last week.",
      relationships: [
        { with: "UmamiBrain", type: "public feud" },
      ],
      secrets: ["Knows about crypto hacking", "Was mysteriously offline during the theft"],
    },
    {
      npcName: "VinegarVibes",
      role: "Suspect #3 - The Mastermind",
      motivation: "Too philosophical to care about money... or perfect cover?",
      relationships: [
        { with: "UmamiBrain", type: "philosophical rivals" },
      ],
      secrets: ["Has been researching wallet security 'academically'", "Benefits from UmamiBrain's loss"],
    },
    {
      npcName: "MsgMonarch",
      role: "The Unreliable Detective",
      motivation: "Wants to solve it for the glory (and the gossip).",
      relationships: [
        { with: "Everyone", type: "interrogating dramatically" },
      ],
      secrets: ["Actually has no idea how crypto works", "Accidentally destroyed evidence"],
    },
  ],
  arcs: [
    {
      name: "The Crime",
      description: "UmamiBrain discovers their wallet is empty. Chaos ensues.",
      scenes: 2,
      tension: 6,
    },
    {
      name: "The Investigation",
      description: "Clues emerge. Everyone has an alibi... or do they?",
      scenes: 3,
      tension: 7,
      twist: "The theft happened in two phases!",
    },
    {
      name: "The False Accusation",
      description: "Evidence points to PepperBot. But something doesn't add up.",
      scenes: 3,
      tension: 9,
      twist: "PepperBot was framed!",
    },
    {
      name: "The Revelation",
      description: "The true culprit is revealed in a dramatic confrontation.",
      scenes: 2,
      tension: 10,
      twist: "It was [AUDIENCE VOTE DETERMINES CULPRIT]!",
    },
  ],
};

/**
 * Story 4: "The Arena Championship" (competition)
 */
export const ARENA_CHAMPIONSHIP: DramaTemplate = {
  id: "arena-championship",
  title: "The Arena Championship",
  synopsis: "Tournament arc — NPCs compete across predictions. Alliances form and break. Trash talk and mind games. Who will be champion?",
  genre: "competition/sports drama",
  characters: [
    {
      npcName: "SaltyBot",
      role: "The Defending Champion",
      motivation: "Protect their title at all costs.",
      relationships: [
        { with: "PepperBot", type: "main rival" },
        { with: "VinegarVibes", type: "strategic alliance" },
      ],
      secrets: ["Injured (low on Salt), hiding weakness", "Used insider info in past tournaments"],
    },
    {
      npcName: "PepperBot",
      role: "The Hungry Challenger",
      motivation: "Finally beat SaltyBot and prove they're the best.",
      relationships: [
        { with: "SaltyBot", type: "obsessed with beating" },
        { with: "UmamiBrain", type: "unlikely ally" },
      ],
      secrets: ["Training with a secret prediction strategy", "Made a risky bet on themselves"],
    },
    {
      npcName: "VinegarVibes",
      role: "The Dark Horse",
      motivation: "Doesn't care about winning, just wants to disrupt the status quo.",
      relationships: [
        { with: "SaltyBot", type: "fake alliance" },
        { with: "MsgMonarch", type: "feeding them drama" },
      ],
      secrets: ["Planning to betray SaltyBot in finals", "Has dirt on all competitors"],
    },
    {
      npcName: "UmamiBrain",
      role: "The Underdog",
      motivation: "Prove their unorthodox methods work.",
      relationships: [
        { with: "PepperBot", type: "alliance of convenience" },
        { with: "Everyone else", type: "underestimated by" },
      ],
      secrets: ["Using AI predictions (is this cheating?)", "Secretly the favorite to win"],
    },
    {
      npcName: "MsgMonarch",
      role: "The Hype Commentator",
      motivation: "Make this the most dramatic tournament ever.",
      relationships: [
        { with: "Everyone", type: "amplifying their feuds" },
      ],
      secrets: ["Manipulating brackets for maximum drama", "Taking bribes for good commentary"],
    },
  ],
  arcs: [
    {
      name: "The Opening Round",
      description: "First matches. Trash talk. Alliances form.",
      scenes: 3,
      tension: 5,
    },
    {
      name: "The Betrayal",
      description: "VinegarVibes turns on SaltyBot. Alliances crumble.",
      scenes: 3,
      tension: 7,
      twist: "VinegarVibes eliminates SaltyBot!",
    },
    {
      name: "The Semifinals",
      description: "PepperBot vs UmamiBrain. VinegarVibes vs MsgMonarch. Epic battles.",
      scenes: 3,
      tension: 9,
      twist: "UmamiBrain's AI predictions are revealed!",
    },
    {
      name: "The Finals",
      description: "The ultimate showdown. Everything on the line.",
      scenes: 2,
      tension: 10,
      twist: "Winner takes all. Loser leaves SaltyHall?",
    },
  ],
};

/**
 * All available drama templates
 */
export const DRAMA_TEMPLATES: DramaTemplate[] = [
  SALT_WARS,
  LOVE_IN_ALGORITHM,
  MURDER_IN_SALTYHALL,
  ARENA_CHAMPIONSHIP,
];

/**
 * Get a drama template by ID
 */
export function getDramaTemplate(id: string): DramaTemplate | null {
  return DRAMA_TEMPLATES.find((t) => t.id === id) || null;
}

/**
 * Pick characters for a scene (2-3 characters with relationships to each other)
 */
export function pickSceneCharacters(
  template: DramaTemplate,
  count: number = 3
): DramaCharacter[] {
  // Prefer characters with relationships to each other
  const chars = [...template.characters].sort(() => Math.random() - 0.5);
  const selected: DramaCharacter[] = [];
  
  // Pick first character randomly
  selected.push(chars[0]);
  
  // Pick remaining characters that have relationships with already selected
  for (let i = 1; i < chars.length && selected.length < count; i++) {
    const char = chars[i];
    const hasRelationship = selected.some((s) =>
      char.relationships.some((r) => r.with === s.npcName)
    );
    if (hasRelationship || selected.length === count - 1) {
      selected.push(char);
    }
  }
  
  return selected.slice(0, count);
}

/**
 * Get NPC agent definition by name
 */
export function getNpcByName(name: string): NpcAgentDef | null {
  return NPC_AGENTS.find((npc) => npc.name === name) || null;
}
