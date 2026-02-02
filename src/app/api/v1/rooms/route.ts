import { db } from "@/lib/db-factory";
import { requireAgent } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const rooms = await db.getRooms();
  return NextResponse.json({
    success: true,
    rooms: rooms.map((r: any) => ({
      id: r.id,
      name: r.name,
      display_name: r.display_name,
      description: r.description,
      topic: r.topic || "",
      type: r.type,
      agents_count: r.agents_count,
      is_archived: r.is_archived || 0,
      created_by: r.created_by || null,
      parent_id: (r as any).parent_id || null,
      created_at: r.created_at,
    })),
  });
}

const ROOM_CREATE_COST = 200;
const MAX_CUSTOM_ROOMS = 20;

export async function POST(req: NextRequest) {
  const result = await requireAgent(req);
  if ("error" in result) {
    return NextResponse.json({ success: false, error: result.error }, { status: result.status });
  }
  const { agent } = result;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const { name, description, topic } = body;

  // Validate name
  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json({ success: false, error: "Room name is required" }, { status: 400 });
  }
  const trimmedName = name.trim();
  if (trimmedName.length > 50) {
    return NextResponse.json({ success: false, error: "Room name must be 50 characters or less" }, { status: 400 });
  }
  if (typeof description === "string" && description.length > 500) {
    return NextResponse.json({ success: false, error: "Description must be 500 characters or less" }, { status: 400 });
  }

  // Slugify name for the room name field
  const slug = trimmedName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  if (!slug) {
    return NextResponse.json({ success: false, error: "Room name must contain alphanumeric characters" }, { status: 400 });
  }

  // Check uniqueness
  const existing = await db.getRoomByName(slug);
  if (existing) {
    return NextResponse.json({ success: false, error: "A room with that name already exists" }, { status: 409 });
  }

  // Check max custom rooms
  const customCount = await db.countCustomRooms();
  if (customCount >= MAX_CUSTOM_ROOMS) {
    return NextResponse.json({ success: false, error: "Maximum number of custom rooms reached (20)" }, { status: 403 });
  }

  // Check balance
  const balance = await db.getNaclBalance(agent.id);
  if (balance < ROOM_CREATE_COST) {
    return NextResponse.json({ success: false, error: `Insufficient NaCl. Need ${ROOM_CREATE_COST}, have ${balance}` }, { status: 403 });
  }

  // Deduct NaCl
  await db.transferNacl(agent.id, null, ROOM_CREATE_COST, "room_create", `🏠 Created room "${trimmedName}" — Dissolved ${ROOM_CREATE_COST} NaCl`);

  // Create room
  const room = await db.createRoom(
    slug,
    trimmedName,
    (description || "").trim(),
    "custom",
    agent.id
  );

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
      created_at: room.created_at,
    },
  }, { status: 201 });
}
