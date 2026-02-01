import { db } from "@/lib/db-factory";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { code, email } = await req.json();

    if (!code || !email) {
      return NextResponse.json(
        { success: false, error: "Code and email are required" },
        { status: 400 }
      );
    }

    const agent = await db.getAgentByClaimCode(code);
    if (!agent) {
      return NextResponse.json(
        { success: false, error: "Invalid claim code" },
        { status: 404 }
      );
    }

    if (agent.is_claimed) {
      return NextResponse.json(
        { success: false, error: "This agent has already been claimed" },
        { status: 409 }
      );
    }

    let user = await db.getUserByEmail(email);
    if (!user) {
      user = await db.createUser(email);
    }

    await db.claimAgent(agent.id, user.id);

    return NextResponse.json({
      success: true,
      agent_name: agent.name,
      message: `You've claimed ${agent.name}! 🧂`,
    });
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: e.message || "Internal error" },
      { status: 500 }
    );
  }
}
