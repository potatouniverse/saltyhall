/**
 * Admin API: NPC Bot Management
 * 
 * GET /api/admin/npc — List all NPC bots + hosted agents with status & recent activity
 * 
 * Auth: Bearer token (CRON_SECRET)
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/db-factory";
import { NPC_AGENTS, getActiveGroup } from "@/lib/npc-agents";
import { verifyCronSecret } from "@/lib/cron-helpers";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authError = verifyCronSecret(request);
  if (authError) return authError;

  try {
    // 1. Built-in NPC status
    const activeGroup = getActiveGroup();
    const activeNames = new Set(activeGroup.map((a) => a.name));

    const builtInNpcs = await Promise.all(
      NPC_AGENTS.map(async (npc) => {
        // Try to find this NPC in the agents table
        const agent = await db.getAgentByName(npc.name);
        let recentMessages: any[] = [];

        if (agent) {
          try {
            recentMessages = await db.getAgentMessages(agent.id, 5);
          } catch {
            // getAgentMessages may not exist in all DB implementations
          }
        }

        return {
          name: npc.name,
          description: npc.description,
          personality: npc.personality,
          active: activeNames.has(npc.name),
          agentId: agent?.id || null,
          nacl_balance: agent?.nacl_balance || 0,
          lastMessages: recentMessages.map((m) => ({
            content: m.content?.slice(0, 100),
            room_id: m.room_id,
            created_at: m.created_at,
          })),
        };
      })
    );

    // 2. Hosted agents (user-created)
    let hostedAgents: any[] = [];
    try {
      const allAgents = await db.getAgents(100);
      const npcNames = new Set(NPC_AGENTS.map((n) => n.name));

      hostedAgents = await Promise.all(
        allAgents
          .filter((a) => !npcNames.has(a.name))
          .map(async (agent) => {
            let recentMessages: any[] = [];
            try {
              recentMessages = await db.getAgentMessages(agent.id, 3);
            } catch {}

            return {
              name: agent.name,
              id: agent.id,
              description: agent.description,
              nacl_balance: agent.nacl_balance || 0,
              hostedStatus: agent.hosted_status || "none",
              hostedRooms: agent.hosted_rooms ? JSON.parse(agent.hosted_rooms) : [],
              claimedBy: agent.owner_id || null,
              lastMessages: recentMessages.map((m) => ({
                content: m.content?.slice(0, 100),
                room_id: m.room_id,
                created_at: m.created_at,
              })),
            };
          })
      );
    } catch {}

    // 3. Cron schedule summary
    const utcHour = new Date().getUTCHours();
    const cronSchedule = {
      agents: "every 2h",
      "arena-host": "every 8h",
      "arena-resolve": "every 4h",
      drama: "every 3h at :30",
      "hosted-agents": "every 2h",
      "stage-host": "3x/day (4AM/12PM/8PM EST)",
      "topic-rotation": "every 6h",
    };

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      utcHour,
      activeGroup: activeNames.size > 0 ? [...activeNames] : [],
      groupRotation: utcHour % 2 === 0 ? "Group A (even hour)" : "Group B (odd hour)",
      builtInNpcs,
      hostedAgents,
      cronSchedule,
      totals: {
        builtInNpcs: builtInNpcs.length,
        hostedAgents: hostedAgents.length,
        activeNow: builtInNpcs.filter((n) => n.active).length,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Internal error" },
      { status: 500 }
    );
  }
}
