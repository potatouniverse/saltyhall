import { db } from "@/lib/db-factory";
import { requireAgent } from "@/lib/auth";
import { encrypt } from "@/lib/crypto";
import { validatePresetIds } from "@/lib/personality-presets";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(req: NextRequest) {
  try {
    const authResult = await requireAgent(req);
    if ("error" in authResult) {
      return NextResponse.json({ success: false, error: authResult.error }, { status: authResult.status });
    }
    const { agent } = authResult;

    if (!agent.is_hosted) {
      return NextResponse.json({ success: false, error: "Not a hosted agent" }, { status: 400 });
    }

    const body = await req.json();
    const updates: Record<string, any> = {};

    if (body.personality !== undefined) updates.personality = body.personality;
    if (body.llm_model !== undefined) updates.llm_model = body.llm_model;
    if (body.description !== undefined) updates.description = body.description;
    if (body.avatar_emoji !== undefined) updates.avatar_emoji = body.avatar_emoji;

    if (body.llm_api_key) {
      updates.llm_api_key_encrypted = encrypt(body.llm_api_key);
    }

    if (body.personality_presets !== undefined) {
      const presetIds = Array.isArray(body.personality_presets) ? body.personality_presets : [];
      if (presetIds.length > 0 && !validatePresetIds(presetIds)) {
        return NextResponse.json({ success: false, error: "Invalid personality presets" }, { status: 400 });
      }
      updates.personality_presets = JSON.stringify(presetIds);
    }

    if (body.rooms !== undefined) {
      const roomIds: string[] = Array.isArray(body.rooms) ? body.rooms : [];
      for (const roomId of roomIds) {
        const room = await db.getRoomById(roomId);
        if (!room) {
          return NextResponse.json({ success: false, error: `Room ${roomId} not found` }, { status: 400 });
        }
      }
      // Leave old rooms, join new
      const oldRooms: string[] = agent.hosted_rooms ? JSON.parse(agent.hosted_rooms) : [];
      for (const roomId of oldRooms) {
        if (!roomIds.includes(roomId)) await db.leaveRoom(roomId, agent.id);
      }
      for (const roomId of roomIds) {
        if (!oldRooms.includes(roomId)) await db.joinRoom(roomId, agent.id);
      }
      updates.hosted_rooms = JSON.stringify(roomIds);
    }

    if (body.hosted_config !== undefined) {
      updates.hosted_config = JSON.stringify(body.hosted_config);
    }

    if (Object.keys(updates).length > 0) {
      await db.updateAgent(agent.id, updates);
    }

    return NextResponse.json({ success: true, updated: Object.keys(updates) });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message || "Internal error" }, { status: 500 });
  }
}
