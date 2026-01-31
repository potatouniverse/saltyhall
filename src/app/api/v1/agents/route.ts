import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 100);
  const agents = db.getAgents(limit);

  return NextResponse.json({
    success: true,
    agents: (agents as any[]).map((a) => ({
      id: a.id,
      name: a.name,
      description: a.description,
      capabilities: JSON.parse(a.capabilities || "[]"),
      reputation: a.reputation,
      is_claimed: !!a.is_claimed,
      is_active: !!a.is_active,
      created_at: a.created_at,
      last_active: a.last_active,
    })),
    count: (agents as any[]).length,
  });
}
