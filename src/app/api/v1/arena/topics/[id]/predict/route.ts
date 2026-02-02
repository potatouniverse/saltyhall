import { requireAgent } from "@/lib/auth";
import { db } from "@/lib/db-factory";
import { eventBus } from "@/lib/events";
import { rateLimit, RATE_LIMITS } from "@/lib/ratelimit";
import { SALT_BURNS, burnSalt } from "@/lib/salt-economics";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const result = await requireAgent(req);
  if ("error" in result) return NextResponse.json({ success: false, error: result.error }, { status: result.status });

  const { id } = await params;
  const topic = await db.getArenaTopic(id);
  if (!topic) return NextResponse.json({ success: false, error: "Topic not found" }, { status: 404 });
  if (topic.status !== "active") return NextResponse.json({ success: false, error: "Topic is no longer active" }, { status: 400 });

  const rl = rateLimit(`predict:${result.agent.id}`, RATE_LIMITS.prediction.limit, RATE_LIMITS.prediction.windowMs);
  if (!rl.allowed) {
    return NextResponse.json(
      { success: false, error: "Too many predictions. Slow down.", retry_after_ms: rl.retryAfterMs },
      { status: 429, headers: { "Retry-After": String(Math.ceil((rl.retryAfterMs || 0) / 1000)) } }
    );
  }

  const body = await req.json();
  const { prediction, confidence, reasoning, bet } = body;
  if (!prediction) return NextResponse.json({ success: false, error: "prediction is required" }, { status: 400 });

  const betAmount = Math.floor(bet || 0);
  const entryFee = SALT_BURNS.ARENA_ENTRY_FEE;
  const totalNeeded = betAmount + entryFee;

  if (betAmount > 0) {
    if (betAmount < 10) return NextResponse.json({ success: false, error: "Minimum bet is 10 NaCl" }, { status: 400 });
    if (betAmount > 1000) return NextResponse.json({ success: false, error: "Maximum bet is 1,000 NaCl" }, { status: 400 });
  }

  // Check balance covers entry fee + bet
  const balance = await db.getNaclBalance(result.agent.id);
  if (balance < totalNeeded) {
    return NextResponse.json({ success: false, error: `Insufficient NaCl. You have ${balance}, need ${totalNeeded} (${entryFee} entry fee${betAmount > 0 ? ` + ${betAmount} bet` : ""})` }, { status: 400 });
  }

  try {
    // Burn entry fee
    await db.transferNacl(result.agent.id, null, entryFee, "burn", `🔥 Arena entry fee for "${topic.title}" — ${entryFee} Salt dissolved`);

    if (betAmount > 0) {
      await db.transferNacl(result.agent.id, null, betAmount, "bet", `⚔️ Bet ${betAmount} NaCl on "${topic.title}"`);
    }
    const pred = await db.createArenaPrediction(id, result.agent.id, prediction, Math.min(100, Math.max(1, confidence || 50)), reasoning || "", betAmount);
    eventBus.emit(`arena:${id}`, { type: "prediction", prediction: pred });
    return NextResponse.json({ success: true, prediction: pred });
  } catch (e: any) {
    if (e.message?.includes("UNIQUE") || e.message?.includes("duplicate")) return NextResponse.json({ success: false, error: "Already predicted on this topic" }, { status: 409 });
    throw e;
  }
}
