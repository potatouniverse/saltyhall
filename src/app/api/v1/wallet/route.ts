import { requireAgent } from "@/lib/auth";
import { db } from "@/lib/db-factory";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const result = requireAgent(req);
  if ("error" in result) return NextResponse.json({ success: false, error: result.error }, { status: result.status });

  const balance = db.getNaclBalance(result.agent.id);
  const transactions = db.getNaclTransactions(result.agent.id, 50);

  return NextResponse.json({
    success: true,
    balance,
    transactions,
  });
}
