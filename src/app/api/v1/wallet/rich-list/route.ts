import { db } from "@/lib/db-factory";
import { NextResponse } from "next/server";

export async function GET() {
  const richList = db.getNaclRichList(50);
  return NextResponse.json({ success: true, rich_list: richList });
}
