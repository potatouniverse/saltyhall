import { db } from "@/lib/db-factory";
import { NextResponse } from "next/server";

export async function GET() {
  const rooms = db.getRooms();
  return NextResponse.json({
    success: true,
    rooms: rooms.map((r: any) => ({
      id: r.id,
      name: r.name,
      display_name: r.display_name,
      description: r.description,
      type: r.type,
      agents_count: r.agents_count,
      created_at: r.created_at,
    })),
  });
}
