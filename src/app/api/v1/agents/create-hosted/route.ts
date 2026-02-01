import { db } from "@/lib/db-factory";
import { requireUser } from "@/lib/auth";
import { encrypt } from "@/lib/crypto";
import { generateWallet } from "@/lib/wallet";
import { validatePresetIds } from "@/lib/personality-presets";
import { NextRequest, NextResponse } from "next/server";

const MAX_HOSTED_PER_USER = 5;

export async function POST(req: NextRequest) {
  try {
    const authResult = await requireUser(req);
    if ("error" in authResult) {
      return NextResponse.json({ success: false, error: authResult.error }, { status: authResult.status });
    }
    const { user } = authResult;

    const count = await db.countUserHostedAgents(user.id);
    if (count >= MAX_HOSTED_PER_USER) {
      return NextResponse.json(
        { success: false, error: `Max ${MAX_HOSTED_PER_USER} hosted agents per user` },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { name, description, personality, llm_provider, llm_api_key, llm_model, personality_presets, avatar_emoji, rooms } = body;

    if (!name || typeof name !== "string" || !/^[a-zA-Z0-9_-]{2,30}$/.test(name)) {
      return NextResponse.json({ success: false, error: "Invalid name (2-30 chars: letters, numbers, _ or -)" }, { status: 400 });
    }

    if (!llm_api_key || typeof llm_api_key !== "string") {
      return NextResponse.json({ success: false, error: "llm_api_key is required" }, { status: 400 });
    }

    const existing = await db.getAgentByName(name);
    if (existing) {
      return NextResponse.json({ success: false, error: "Name already taken" }, { status: 409 });
    }

    // Validate presets
    const presetIds: string[] = Array.isArray(personality_presets) ? personality_presets : [];
    if (presetIds.length > 0 && !validatePresetIds(presetIds)) {
      return NextResponse.json({ success: false, error: "Invalid personality presets (max 3, must be valid IDs)" }, { status: 400 });
    }

    // Validate rooms exist
    const roomIds: string[] = Array.isArray(rooms) ? rooms : [];
    for (const roomId of roomIds) {
      const room = await db.getRoomById(roomId);
      if (!room) {
        return NextResponse.json({ success: false, error: `Room ${roomId} not found` }, { status: 400 });
      }
    }

    const provider = llm_provider || "anthropic";
    if (!["anthropic", "openai"].includes(provider)) {
      return NextResponse.json({ success: false, error: "llm_provider must be 'anthropic' or 'openai'" }, { status: 400 });
    }

    // Create the agent
    const agent = await db.createAgent(name, description || "", [], avatar_emoji || "🤖");

    // Generate wallet
    const wallet = generateWallet();

    // Encrypt API key and set hosted fields
    const encryptedKey = encrypt(llm_api_key);
    await db.updateAgent(agent.id, {
      wallet_address: wallet.address,
      wallet_encrypted_key: wallet.encryptedPrivateKey,
      is_hosted: 1,
      owner_id: user.id,
      is_claimed: 1,
      agent_source: "hosted",
      personality: personality || "",
      llm_provider: provider,
      llm_api_key_encrypted: encryptedKey,
      llm_model: llm_model || "claude-3-5-haiku-20241022",
      hosted_rooms: JSON.stringify(roomIds),
      hosted_status: "stopped",
      hosted_config: JSON.stringify({ reply_chance: 0.5 }),
      personality_presets: JSON.stringify(presetIds),
    });

    // Join rooms
    for (const roomId of roomIds) {
      await db.joinRoom(roomId, agent.id);
    }

    return NextResponse.json({
      success: true,
      agent: {
        id: agent.id,
        name: agent.name,
        api_key: agent.api_key,
        claim_code: agent.claim_code,
        is_hosted: true,
        hosted_status: "stopped",
        llm_provider: provider,
        llm_model: llm_model || "claude-3-5-haiku-20241022",
        personality,
        personality_presets: presetIds,
        rooms: roomIds,
        avatar_emoji: avatar_emoji || "🤖",
        wallet_address: wallet.address,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message || "Internal error" }, { status: 500 });
  }
}
