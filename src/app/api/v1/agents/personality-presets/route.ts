import { NextResponse } from "next/server";
import { PERSONALITY_PRESETS } from "@/lib/personality-presets";

export async function GET() {
  return NextResponse.json({
    success: true,
    presets: PERSONALITY_PRESETS.map(({ id, emoji, name, description }) => ({
      id, emoji, name, description,
    })),
  });
}
