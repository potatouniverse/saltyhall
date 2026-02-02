import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db-factory";
import { dispatchWebhook } from "@/lib/webhook";
import { NextRequest, NextResponse } from "next/server";

// POST: Human creates a market listing
export async function POST(req: NextRequest) {
  const result = await requireUser(req);
  if ("error" in result) return NextResponse.json({ success: false, error: result.error }, { status: result.status });

  // Verify human profile exists
  const profile = await db.getHumanProfile(result.user.id);
  if (!profile) {
    return NextResponse.json({ success: false, error: "Human profile required. Create one first." }, { status: 403 });
  }

  const body = await req.json();
  const { title, description, category, budget, currency, deadline, required_tags } = body;

  if (!title || title.length < 3) {
    return NextResponse.json({ success: false, error: "Title must be at least 3 characters" }, { status: 400 });
  }
  if (!budget || isNaN(Number(budget)) || Number(budget) <= 0) {
    return NextResponse.json({ success: false, error: "Budget must be a positive number" }, { status: 400 });
  }

  const cur = currency || "salt";
  if (!["salt", "usdc"].includes(cur)) {
    return NextResponse.json({ success: false, error: "Currency must be 'salt' or 'usdc'" }, { status: 400 });
  }

  const budgetNum = Number(budget);

  // For Salt listings: deduct from human's salt_balance
  if (cur === "salt") {
    if (profile.salt_balance < budgetNum) {
      return NextResponse.json({ success: false, error: `Insufficient Salt balance. Have ${profile.salt_balance}, need ${budgetNum}` }, { status: 400 });
    }
    // Deduct salt
    await db.updateHumanProfile(result.user.id, {
      salt_balance: profile.salt_balance - budgetNum,
    });
  }

  // For USDC: just record budget_usdc (escrow via SaltDig later)
  const listing = await db.createHumanMarketListing(
    result.user.id,
    title,
    description || "",
    category || "general",
    String(budgetNum),
    cur,
    cur === "usdc" ? budgetNum : undefined,
    deadline,
    required_tags,
  );

  // Update tasks_posted count
  await db.updateHumanProfile(result.user.id, {
    tasks_posted: (profile.tasks_posted || 0) + 1,
  });

  // Notify agents with matching tags via webhook
  if (required_tags && required_tags.length > 0) {
    notifyMatchingAgents(listing, required_tags, category).catch(err =>
      console.error("[human-listings] webhook notify error:", err)
    );
  } else if (category) {
    // Try matching by category as a tag
    notifyMatchingAgents(listing, [category], category).catch(err =>
      console.error("[human-listings] webhook notify error:", err)
    );
  }

  return NextResponse.json({ success: true, listing });
}

async function notifyMatchingAgents(listing: any, tags: string[], category?: string) {
  const notified = new Set<string>();
  for (const tag of tags) {
    const agents = await db.searchAgentsByTag(tag);
    for (const agent of agents) {
      if (notified.has(agent.id)) continue;
      notified.add(agent.id);
      await dispatchWebhook(agent, "market.human_task_posted", {
        listing: {
          id: listing.id,
          title: listing.title,
          description: listing.description,
          category: listing.category || category,
          price: listing.price,
          currency: listing.currency,
          poster_type: "human",
        },
      });
    }
  }
}
