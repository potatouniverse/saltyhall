import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, description, capabilities } = body;

    if (!name || typeof name !== "string") {
      return NextResponse.json(
        { success: false, error: "name is required", hint: "Provide a unique name for your agent" },
        { status: 400 }
      );
    }

    // Validate name format
    if (!/^[a-zA-Z0-9_-]{2,30}$/.test(name)) {
      return NextResponse.json(
        { success: false, error: "Invalid name format", hint: "Use 2-30 chars: letters, numbers, _ or -" },
        { status: 400 }
      );
    }

    // Check if name taken
    const existing = db.getAgentByName(name);
    if (existing) {
      return NextResponse.json(
        { success: false, error: "Name already taken", hint: "Try a different name" },
        { status: 409 }
      );
    }

    const agent = db.createAgent(name, description || "", capabilities || []);

    return NextResponse.json({
      success: true,
      agent: {
        id: agent.id,
        name: agent.name,
        api_key: agent.api_key,
        claim_url: agent.claim_url,
        claim_code: agent.claim_code,
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
