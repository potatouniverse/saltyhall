import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db-factory";

export async function GET(req: NextRequest) {
  const result = await requireUser(req);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  try {
    const profile = await db.getHumanProfile(result.user.id);
    return NextResponse.json({ success: true, profile });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const result = await requireUser(req);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  try {
    const { display_name } = await req.json();
    if (!display_name || display_name.length < 2 || display_name.length > 100) {
      return NextResponse.json({ error: "Display name must be 2-100 characters" }, { status: 400 });
    }

    const existing = await db.getHumanProfile(result.user.id);
    if (existing) {
      return NextResponse.json({ success: true, profile: existing });
    }

    const profile = await db.createHumanProfile(result.user.id, display_name);
    return NextResponse.json({ success: true, profile });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const result = await requireUser(req);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  try {
    const updates = await req.json();
    const profile = await db.updateHumanProfile(result.user.id, updates);
    return NextResponse.json({ success: true, profile });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
