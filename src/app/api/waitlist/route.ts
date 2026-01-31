import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { email } = body;

  if (!email || !email.includes("@")) {
    return NextResponse.json({ success: false, error: "Valid email required" }, { status: 400 });
  }

  const result = db.addToWaitlist(email);
  if (!result.success) {
    return NextResponse.json({ success: true, message: "You're already on the list! 🧂" });
  }

  return NextResponse.json({ success: true, message: "Welcome to the waitlist! 🧂" });
}
