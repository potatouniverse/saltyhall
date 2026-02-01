/**
 * Agent Memory Management System
 * 
 * Provides persistent memory storage with semantic search capabilities.
 * Categories: fact, preference, experience, skill, relationship
 */

import { db } from "./db-factory";
import type { AgentMemoryRecord } from "./db-interface";

export type MemoryCategory = "fact" | "preference" | "experience" | "skill" | "relationship";

export const VALID_CATEGORIES: MemoryCategory[] = [
  "fact",
  "preference", 
  "experience",
  "skill",
  "relationship"
];

export interface StoreMemoryOptions {
  agentId: string;
  key?: string;
  value: string;
  category?: MemoryCategory;
}

export interface RecallMemoryOptions {
  agentId: string;
  query: string;
  limit?: number;
}

export interface ListMemoriesOptions {
  agentId: string;
  category?: MemoryCategory;
  limit?: number;
}

/**
 * Store a memory entry for an agent
 */
export async function storeMemory(options: StoreMemoryOptions): Promise<AgentMemoryRecord> {
  const { agentId, key, value, category = "experience" } = options;

  if (!VALID_CATEGORIES.includes(category)) {
    throw new Error(`Invalid category: ${category}. Must be one of: ${VALID_CATEGORIES.join(", ")}`);
  }

  // If key provided, check for existing memory with same key and update
  if (key) {
    const existing = await db.getAgentMemoryByKey(agentId, key);
    if (existing) {
      await db.updateAgentMemory(existing.id, {
        content: value,
        category,
        embedding_text: value, // Store raw value for future semantic search
        updated_at: new Date().toISOString()
      });
      return db.getAgentMemoryById(existing.id) as Promise<AgentMemoryRecord>;
    }
  }

  // Create new memory
  return db.createAgentMemory(agentId, value, category, key);
}

/**
 * Recall memories using semantic search
 * Currently uses simple text matching - can be enhanced with embeddings later
 */
export async function recallMemory(options: RecallMemoryOptions): Promise<AgentMemoryRecord[]> {
  const { agentId, query, limit = 10 } = options;

  // Simple text-based search for now
  // TODO: Implement proper semantic search with embeddings
  const allMemories = await db.getAgentMemories(agentId);
  
  const scored = allMemories
    .map(mem => ({
      memory: mem,
      score: calculateRelevanceScore(query, mem.content)
    }))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(item => item.memory);

  return scored;
}

/**
 * List memories by category
 */
export async function listMemories(options: ListMemoriesOptions): Promise<AgentMemoryRecord[]> {
  const { agentId, category, limit = 50 } = options;

  if (category && !VALID_CATEGORIES.includes(category)) {
    throw new Error(`Invalid category: ${category}. Must be one of: ${VALID_CATEGORIES.join(", ")}`);
  }

  const memories = await db.getAgentMemories(agentId, category);
  return memories.slice(0, limit);
}

/**
 * Delete a specific memory
 */
export async function deleteMemory(agentId: string, memoryId: string): Promise<void> {
  await db.deleteAgentMemory(agentId, memoryId);
}

/**
 * Summarize old memories into compressed summaries
 * Groups memories by category and creates summary entries
 */
export async function summarizeMemories(agentId: string): Promise<{ summaries: string[]; compressed: number }> {
  const memories = await db.getAgentMemories(agentId);
  
  // Group by category
  const byCategory: Record<string, AgentMemoryRecord[]> = {};
  for (const mem of memories) {
    const cat = mem.category || "experience";
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(mem);
  }

  const summaries: string[] = [];
  let compressed = 0;

  for (const [category, mems] of Object.entries(byCategory)) {
    if (mems.length < 5) continue; // Only summarize if we have enough memories

    // Take oldest memories (first 70%)
    const toSummarize = mems.slice(0, Math.floor(mems.length * 0.7));
    
    if (toSummarize.length === 0) continue;

    // Create summary text
    const summaryText = `Summary of ${toSummarize.length} ${category} memories: ${toSummarize
      .map(m => m.content)
      .join("; ")}`;

    summaries.push(summaryText);

    // Store summary as new memory
    await storeMemory({
      agentId,
      key: `summary_${category}_${Date.now()}`,
      value: summaryText,
      category: category as MemoryCategory
    });

    // Delete old memories
    for (const mem of toSummarize) {
      await deleteMemory(agentId, mem.id);
    }

    compressed += toSummarize.length;
  }

  return { summaries, compressed };
}

/**
 * Simple relevance scoring based on keyword matching
 * TODO: Replace with proper semantic similarity using embeddings
 */
function calculateRelevanceScore(query: string, content: string): number {
  const queryWords = query.toLowerCase().split(/\s+/);
  const contentLower = content.toLowerCase();
  
  let score = 0;
  for (const word of queryWords) {
    if (word.length < 3) continue; // Skip short words
    if (contentLower.includes(word)) {
      score += 1;
      // Bonus for exact phrase match
      if (contentLower.includes(query.toLowerCase())) {
        score += 2;
      }
    }
  }
  
  return score;
}

/**
 * Agent tool definitions for self-managed memory
 * These tools are injected into hosted agent prompts
 */
export const MEMORY_TOOLS = [
  {
    name: "remember",
    description: "Store a memory for later recall. Use this to remember important facts, preferences, or experiences.",
    parameters: {
      key: "Optional unique key for this memory (e.g., 'user_name', 'favorite_color')",
      value: "The content to remember",
      category: `Category: ${VALID_CATEGORIES.join(", ")} (default: experience)`
    },
    example: 'remember(key="user_timezone", value="Pacific Time", category="preference")'
  },
  {
    name: "recall",
    description: "Search your memories for relevant information",
    parameters: {
      query: "What you want to remember (e.g., 'timezone', 'favorite food')",
      limit: "Max results to return (default: 5)"
    },
    example: 'recall(query="timezone preferences", limit=3)'
  },
  {
    name: "forget",
    description: "Delete a specific memory by ID",
    parameters: {
      memoryId: "The ID of the memory to delete"
    },
    example: 'forget(memoryId="abc-123")'
  }
];

/**
 * Format memory tools for agent system prompts
 */
export function formatMemoryToolsForPrompt(): string {
  return `
## Memory Tools

You have access to persistent memory across sessions:

${MEMORY_TOOLS.map(tool => `
### ${tool.name}
${tool.description}

Parameters:
${Object.entries(tool.parameters).map(([k, v]) => `- ${k}: ${v}`).join("\n")}

Example: ${tool.example}
`).join("\n")}

Use these tools to remember important context between conversations.
`;
}
