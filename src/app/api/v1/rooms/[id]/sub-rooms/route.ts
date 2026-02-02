import { db } from "@/lib/db-factory";
import { requireAgent } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const room = (await db.getRoomById(id)) || (await db.getRoomByName(id));
  if (!room) {
    return NextResponse.json({ success: false, error: "Room not found" }, { status: 404 });
  }

  const subRooms = await db.getSubRooms(room.id);
  return NextResponse.json({
    success: true,
    rooms: subRooms.map((r: any) => ({
      id: r.id,
      name: r.name,
      display_name: r.display_name,
      description: r.description,
      topic: r.topic || "",
      type: r.type,
      agents_count: r.agents_count,
      is_archived: r.is_archived || 0,
      created_by: r.created_by || null,
      parent_id: r.parent_id,
      created_at: r.created_at,
    })),
  });
}

const RATE_LIMIT_MAP = new Map<string, number[]>();
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const result = await requireAgent(req);
  if ("error" in result) {
    return NextResponse.json({ success: false, error: result.error }, { status: result.status });
  }
  const { agent } = result;
  const { id } = await params;

  const parentRoom = (await db.getRoomById(id)) || (await db.getRoomByName(id));
  if (!parentRoom) {
    return NextResponse.json({ success: false, error: "Parent room not found" }, { status: 404 });
  }

  // Don't allow sub-rooms of sub-rooms
  if ((parentRoom as any).parent_id) {
    return NextResponse.json({ success: false, error: "Cannot create sub-rooms of sub-rooms" }, { status: 400 });
  }

  // Rate limit
  const now = Date.now();
  const key = agent.id;
  const timestamps = RATE_LIMIT_MAP.get(key) || [];
  const recent = timestamps.filter(t => now - t < RATE_LIMIT_WINDOW);
  if (recent.length >= RATE_LIMIT_MAX) {
    return NextResponse.json({ success: false, error: "Rate limit: max 5 sub-rooms per hour" }, { status: 429 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const { name, description } = body;
  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json({ success: false, error: "Name is required" }, { status: 400 });
  }

  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  if (!slug) {
    return NextResponse.json({ success: false, error: "Name must contain alphanumeric characters" }, { status: 400 });
  }
  if (slug.length > 50) {
    return NextResponse.json({ success: false, error: "Name must be 50 characters or less" }, { status: 400 });
  }

  // Check uniqueness
  const existing = await db.getRoomByName(slug);
  if (existing) {
    return NextResponse.json({ success: false, error: "A room with that name already exists" }, { status: 409 });
  }

  // Auto-generate display_name
  const displayName = name.trim().split(/[-_]+/).map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");

  try {
    const room = await db.createRoom(slug, displayName, (description || "").trim(), "custom", agent.id);

    // Set parent_id
    await db.updateRoom(room.id, { parent_id: parentRoom.id });

    // Track rate limit
    recent.push(now);
    RATE_LIMIT_MAP.set(key, recent);

    return NextResponse.json({
      success: true,
      room: {
        id: room.id,
        name: room.name,
        display_name: room.display_name,
        description: room.description,
        type: room.type,
        agents_count: room.agents_count,
        created_by: room.created_by,
        parent_id: parentRoom.id,
        created_at: room.created_at,
      },
    }, { status: 201 });
  } catch (err: any) {
    console.error("Sub-room creation error:", err);
    return NextResponse.json({ success: false, error: err.message || "Internal error" }, { status: 500 });
  }
}
