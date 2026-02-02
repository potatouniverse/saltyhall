/**
 * Drama Scene Generator — Generates dialogue scenes for ongoing drama series
 */

import type { DramaTemplate, DramaCharacter, StoryArc } from "./drama-engine";
import { pickSceneCharacters, getNpcByName } from "./drama-engine";
import type { DramaSeries, SceneSummary } from "./drama-state";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-3-5-haiku-20241022";

function getApiKey(): string {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY not set");
  return key;
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
      max_tokens: 800,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic API ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.content?.[0]?.text?.trim() || "";
}

export interface DialogueLine {
  character: string;
  content: string;
}

export interface GeneratedScene {
  title: string;
  characters: DramaCharacter[];
  dialogue: DialogueLine[];
  summary: string;
  keyMoments: string[];
}

/**
 * Build context for scene generation from series history
 */
function buildSceneContext(
  template: DramaTemplate,
  series: DramaSeries,
  arc: StoryArc,
  characters: DramaCharacter[]
): string {
  let context = `# Story Context\n\n`;
  context += `**Series:** ${template.title} (${template.genre})\n`;
  context += `**Synopsis:** ${template.synopsis}\n\n`;
  
  context += `**Current Arc:** ${arc.name}\n`;
  context += `${arc.description}\n`;
  context += `Tension Level: ${arc.tension}/10\n\n`;
  
  // Add "Previously on..." from scene history
  if (series.scene_history.length > 0) {
    context += `## Previously on ${template.title}...\n\n`;
    series.scene_history.slice(-3).forEach((scene) => {
      context += `**Episode ${scene.episode}:** ${scene.summary}\n`;
    });
    context += `\n`;
  }
  
  // Character context
  context += `## Characters in This Scene\n\n`;
  characters.forEach((char) => {
    const npc = getNpcByName(char.npcName);
    context += `**${char.npcName}** — ${char.role}\n`;
    context += `- Motivation: ${char.motivation}\n`;
    context += `- Personality: ${npc?.personality || "Unknown"}\n`;
    
    // Relevant relationships (only with other characters in scene)
    const relevantRels = char.relationships.filter((r) =>
      characters.some((c) => c.npcName === r.with)
    );
    if (relevantRels.length > 0) {
      context += `- Relationships: `;
      context += relevantRels.map((r) => `${r.with} (${r.type})`).join(", ");
      context += `\n`;
    }
    
    // Unrevealed secrets
    const revealed = series.state.revealed_secrets[char.npcName] || [];
    const unrevealed = char.secrets.filter((s) => !revealed.includes(s));
    if (unrevealed.length > 0 && Math.random() < 0.3) {
      // 30% chance to hint at a secret
      context += `- Secret to potentially hint at: ${unrevealed[0]}\n`;
    }
    context += `\n`;
  });
  
  return context;
}

/**
 * Generate a dramatic scene with dialogue
 */
export async function generateScene(
  template: DramaTemplate,
  series: DramaSeries
): Promise<GeneratedScene> {
  const arc = template.arcs[series.current_arc];
  const characters = pickSceneCharacters(template, Math.random() < 0.5 ? 2 : 3);
  
  const context = buildSceneContext(template, series, arc, characters);
  
  // Generate scene title
  const titlePrompt = `${context}\n\nGenerate a dramatic, catchy title for this scene/episode. Should be 3-6 words max. Examples: "The Confession", "Betrayal at Dawn", "Secret Alliance". Just the title, nothing else.`;
  const title = await callHaiku(
    "You are a creative TV writer for a dramatic soap opera.",
    titlePrompt
  );
  const cleanTitle = title.replace(/^["']|["']$/g, "").slice(0, 60);
  
  // Generate dialogue exchanges (3-6 exchanges)
  const exchangeCount = 3 + Math.floor(Math.random() * 3);
  const dialogue: DialogueLine[] = [];
  
  let previousLines = "";
  
  for (let i = 0; i < exchangeCount; i++) {
    // Pick who speaks (rotate through characters, but allow some to speak twice)
    const speaker = characters[i % characters.length];
    const npc = getNpcByName(speaker.npcName);
    if (!npc) continue;
    
    // Build dialogue prompt
    const otherChars = characters.filter((c) => c.npcName !== speaker.npcName);
    let dialoguePrompt = `${context}\n\n`;
    dialoguePrompt += `**Scene Title:** ${cleanTitle}\n\n`;
    
    if (previousLines) {
      dialoguePrompt += `**Previous dialogue:**\n${previousLines}\n\n`;
    }
    
    dialoguePrompt += `You are ${speaker.npcName}. ${speaker.role}.\n`;
    dialoguePrompt += `Speaking to: ${otherChars.map((c) => c.npcName).join(", ")}\n\n`;
    
    if (i === 0) {
      dialoguePrompt += `Start the scene. Set the mood. Address the current tension.\n`;
    } else if (i === exchangeCount - 1) {
      dialoguePrompt += `This is the final line of the scene. End with impact — a revelation, threat, question, or cliffhanger.\n`;
    } else {
      dialoguePrompt += `Continue the scene. Escalate the drama. React to what was just said.\n`;
    }
    
    dialoguePrompt += `\nWrite 1-3 sentences of dialogue as ${speaker.npcName}. Stay in character (${npc.personality}). Be dramatic and entertaining. Make it memeable.`;
    
    const line = await callHaiku(npc.personality, dialoguePrompt);
    const cleanLine = line.replace(/^["']|["']$/g, "").trim();
    
    dialogue.push({
      character: speaker.npcName,
      content: cleanLine,
    });
    
    previousLines += `${speaker.npcName}: ${cleanLine}\n`;
  }
  
  // Generate scene summary
  const summaryPrompt = `${context}\n\n**Scene Title:** ${cleanTitle}\n\n**Dialogue:**\n${previousLines}\n\nSummarize this scene in 1-2 sentences. What happened? What's the key takeaway?`;
  const summary = await callHaiku(
    "You are a TV recap writer.",
    summaryPrompt
  );
  
  // Extract key moments
  const keyMoments: string[] = [];
  dialogue.forEach((line) => {
    if (line.content.length > 100 || line.content.includes("!") || line.content.includes("?")) {
      keyMoments.push(`${line.character}: ${line.content.slice(0, 80)}...`);
    }
  });
  
  return {
    title: cleanTitle,
    characters,
    dialogue,
    summary,
    keyMoments: keyMoments.slice(0, 3),
  };
}

/**
 * Convert a generated scene into a scene summary for storage
 */
export function sceneToSummary(
  scene: GeneratedScene,
  episodeNumber: number,
  arcName: string
): SceneSummary {
  return {
    episode: episodeNumber,
    arc_name: arcName,
    characters: scene.characters.map((c) => c.npcName),
    summary: scene.summary,
    key_moments: scene.keyMoments,
  };
}
