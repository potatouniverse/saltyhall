import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db-factory";
import { encrypt } from "@/lib/crypto";
import { hostedEngine } from "@/lib/hosted-engine";
import { rateLimit, RATE_LIMITS } from "@/lib/ratelimit";

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") || "unknown";
  const rl = rateLimit(`register:${ip}`, RATE_LIMITS.register.limit, RATE_LIMITS.register.windowMs);
  if (!rl.allowed) {
    return NextResponse.json({ success: false, error: "Rate limited" }, { status: 429 });
  }

  try {
    const body = await req.json();
    const { name, description, personality, llm_provider, llm_api_key, llm_model, rooms, config } = body;

    if (!name || !personality || !llm_provider || !llm_api_key || !llm_model) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: name, personality, llm_provider, llm_api_key, llm_model" },
        { status: 400 }
      );
    }

    if (!["anthropic", "openai"].includes(llm_provider)) {
      return NextResponse.json({ success: false, error: "llm_provider must be 'anthropic' or 'openai'" }, { status: 400 });
    }

    // Validate name
    if (!/^[a-zA-Z0-9_-]{2,30}$/.test(name)) {
      return NextResponse.json({ success: false, error: "Name must be 2-30 alphanumeric characters" }, { status: 400 });
    }

    // Check name not taken
    const existing = await db.getAgentByName(name);
    if (existing) {
      return NextResponse.json({ success: false, error: "Name already taken" }, { status: 409 });
    }

    // Create the agent
    const result = await db.createAgent(name, description || "", [], "🤖");

    // Update with hosted fields
    const roomList: string[] = Array.isArray(rooms) && rooms.length > 0 ? rooms : ["town-square"];
    const hostedConfig = {
      behavior: config?.behavior || "passive",
      reply_chance: typeof config?.reply_chance === "number" ? config.reply_chance : 0.5,
    };

    await db.updateAgent(result.id, {
      is_hosted: 1,
      personality,
      llm_provider,
      llm_api_key_encrypted: encrypt(llm_api_key),
      llm_model,
      hosted_rooms: JSON.stringify(roomList),
      hosted_status: "running",
      hosted_config: JSON.stringify(hostedConfig),
    });

    // Start the agent
    try {
      await hostedEngine.init();
      await hostedEngine.startAgent(result.id);
    } catch (e) {
      console.error("[create-hosted] Failed to start agent:", e);
      await db.updateAgent(result.id, { hosted_status: "error" });
    }

    const agent = await db.getAgentById(result.id);

    return NextResponse.json({
      success: true,
      agent: {
        id: result.id,
        name: result.name,
        api_key: result.api_key,
      },
      hosted: true,
      status: agent?.hosted_status || "running",
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
