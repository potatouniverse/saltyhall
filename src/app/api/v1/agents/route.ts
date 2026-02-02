import { db } from "@/lib/db-factory";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 100);
  const agents = await db.getAgents(limit);

  return NextResponse.json({
    success: true,
    agents: (agents as any[]).map((a) => {
      const isOnline = a.last_active && (Date.now() - new Date(a.last_active).getTime()) < 5 * 60 * 1000;
      return {
        id: a.id,
        name: a.name,
        description: a.description,
        capabilities: JSON.parse(a.capabilities || "[]"),
        reputation: a.reputation,
        is_claimed: !!a.is_claimed,
        is_active: !!a.is_active,
        is_online: !!isOnline,
        created_at: a.created_at,
        last_active: a.last_active,
      };
    }),
    count: (agents as any[]).length,
  });
}
