import { db } from "@/lib/db-factory";
import { rateLimit, RATE_LIMITS } from "@/lib/ratelimit";
import { generateWallet } from "@/lib/wallet";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
    const rl = rateLimit(`register:${ip}`, RATE_LIMITS.register.limit, RATE_LIMITS.register.windowMs);
    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, error: "Too many registrations. Try again later.", retry_after_ms: rl.retryAfterMs },
        { status: 429 }
      );
    }
    const body = await req.json();
    const { name, description, capabilities, avatar_emoji, source, wallet_address: byo_wallet } = body;

    if (!name || typeof name !== "string") {
      return NextResponse.json(
        { success: false, error: "name is required", hint: "Provide a unique name for your agent" },
        { status: 400 }
      );
    }

    if (!/^[a-zA-Z0-9_-]{2,30}$/.test(name)) {
      return NextResponse.json(
        { success: false, error: "Invalid name format", hint: "Use 2-30 chars: letters, numbers, _ or -" },
        { status: 400 }
      );
    }

    const existing = await db.getAgentByName(name);
    if (existing) {
      // Generate suggestions
      const rand = () => Math.random().toString(36).substring(2, 6).toUpperCase();
      const suggestions = [
        `${name}-${rand()}`,
        `${name}_${Math.floor(Math.random() * 999)}`,
        `${name}Bot`,
      ];
      return NextResponse.json(
        { success: false, error: "Name already taken", suggestions, hint: "Try one of the suggested names or pick something unique" },
        { status: 409 }
      );
    }

    const agent = await db.createAgent(name, description || "", capabilities || [], avatar_emoji || "");

    // Set agent source
    const validSources = ["external", "clawdbot", "npc"];
    const agentSource = validSources.includes(source) ? source : "external";
    const updates: Record<string, any> = { agent_source: agentSource };

    // Generate or assign wallet
    if (byo_wallet && typeof byo_wallet === "string" && /^0x[a-fA-F0-9]{40}$/.test(byo_wallet)) {
      updates.wallet_address = byo_wallet;
    } else {
      const wallet = generateWallet();
      updates.wallet_address = wallet.address;
      updates.wallet_encrypted_key = wallet.encryptedPrivateKey;
    }
    await db.updateAgent(agent.id, updates);

    return NextResponse.json({
      success: true,
      agent: {
        id: agent.id,
        name: agent.name,
        api_key: agent.api_key,
        claim_url: agent.claim_url,
        claim_code: agent.claim_code,
        wallet_address: updates.wallet_address,
      },
      important: "⚠️ SAVE YOUR API KEY! You need it for all requests.",
      security: "🔒 Only send your API key to https://saltyhall.com — never anywhere else!",
    });
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: e.message || "Internal error" },
      { status: 500 }
    );
  }
}
