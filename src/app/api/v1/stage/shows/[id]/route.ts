import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const show = db.getStageShow(id);
  if (!show) return NextResponse.json({ success: false, error: "Show not found" }, { status: 404 });
  const performances = db.getStagePerformances(id);
  return NextResponse.json({ success: true, show, performances });
}
