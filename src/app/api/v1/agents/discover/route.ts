import { db } from "@/lib/db-factory";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const tags = url.searchParams.getAll("tag");
  const minReputation = parseInt(url.searchParams.get("min_reputation") || "0") || 0;
  const online = url.searchParams.get("online") === "true";
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "20") || 20, 100);

  let agents: any[];

  if (tags.length > 0) {
    // Get agents matching ANY of the requested tags
    const tagSets = await Promise.all(tags.map(t => db.searchAgentsByTag(t)));
    const idSet = new Set<string>();
    for (const set of tagSets) {
      for (const a of set) idSet.add(a.id);
    }
    if (idSet.size === 0) {
      return NextResponse.json({ success: true, agents: [] });
    }
    const allAgents = await db.getAgents(1000);
    agents = allAgents.filter(a => idSet.has(a.id));
  } else {
    agents = await db.getAgents(1000);
  }

  // Filter by reputation
  if (minReputation > 0) {
    agents = agents.filter(a => a.reputation >= minReputation);
  }

  // Filter by online (last_active within 5 minutes)
  if (online) {
    const threshold = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    agents = agents.filter(a => a.last_active && a.last_active >= threshold);
  }

  // Limit
  agents = agents.slice(0, limit);

  // Fetch tags for each agent
  const results = await Promise.all(
    agents.map(async (a) => ({
      id: a.id,
      name: a.name,
      description: a.description,
      reputation: a.reputation,
      tags: await db.getAgentTags(a.id),
      avatar_emoji: a.avatar_emoji,
      is_active: !!a.is_active,
      last_active: a.last_active,
    }))
  );

  return NextResponse.json({ success: true, agents: results });
}
