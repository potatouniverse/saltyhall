import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db-factory";
import { encrypt } from "@/lib/crypto";
import { rateLimit, RATE_LIMITS } from "@/lib/ratelimit";

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") || "unknown";
  const rl = rateLimit(`register:${ip}`, RATE_LIMITS.register.limit, RATE_LIMITS.register.windowMs);
  if (!rl.allowed) {
    return NextResponse.json({ success: false, error: "Rate limited" }, { status: 429 });
  }

  try {
    const body = await req.json();
    const { identity, soul, memory, config, llm_api_key } = body;

    if (!identity?.name) {
      return NextResponse.json({ success: false, error: "identity.name is required" }, { status: 400 });
    }
    if (!llm_api_key) {
      return NextResponse.json({ success: false, error: "llm_api_key is required (not included in exports for security)" }, { status: 400 });
    }

    const name = identity.name;
    if (!/^[a-zA-Z0-9_-]{2,30}$/.test(name)) {
      return NextResponse.json({ success: false, error: "Name must be 2-30 alphanumeric characters" }, { status: 400 });
    }

    const existing = await db.getAgentByName(name);
    if (existing) {
      return NextResponse.json({ success: false, error: "Name already taken. Change identity.name before importing." }, { status: 409 });
    }

    const result = await db.createAgent(name, identity.description || soul?.description || "", [], identity.avatar_emoji || "🤖");

    const llmProvider = config?.llm_provider || "anthropic";
    const llmModel = config?.llm_model || "claude-3-5-haiku-20241022";
    const rooms = Array.isArray(config?.rooms) && config.rooms.length > 0 ? config.rooms : ["town-square"];
    const hostedConfig = config?.hosted_config || { behavior: "passive", reply_chance: 0.5 };

    await db.updateAgent(result.id, {
      is_hosted: 1,
      agent_source: "resident",
      personality: soul?.personality || "",
      personality_presets: JSON.stringify(soul?.personality_presets || []),
      llm_provider: llmProvider,
      llm_api_key_encrypted: encrypt(llm_api_key),
      llm_model: llmModel,
      hosted_rooms: JSON.stringify(rooms),
      hosted_status: "stopped",
      hosted_config: JSON.stringify(hostedConfig),
      avatar_emoji: identity.avatar_emoji || "",
    });

    // Import memories
    if (Array.isArray(memory)) {
      for (const m of memory) {
        if (m.content && typeof m.content === "string") {
          await db.createAgentMemory(result.id, m.content, m.category || "general");
        }
      }
    }

    return NextResponse.json({
      success: true,
      agent: {
        id: result.id,
        name: result.name,
        api_key: result.api_key,
      },
      imported: {
        memories: Array.isArray(memory) ? memory.length : 0,
      },
    }, { status: 201 });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
