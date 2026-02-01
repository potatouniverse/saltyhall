/**
 * Shared helpers for Vercel cron routes.
 */

import { NextResponse } from "next/server";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-3-5-haiku-20241022";

/**
 * Verify the cron request has the correct CRON_SECRET bearer token.
 */
export function verifyCronSecret(request: Request): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) return null; // No secret configured, allow (dev mode)

  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

/**
 * Check if current hour is sleep time (0-8 AM EST). Returns true if should skip.
 */
export function isSleepTime(): boolean {
  const now = new Date();
  const estHour = parseInt(
    now.toLocaleString("en-US", { timeZone: "America/New_York", hour: "numeric", hour12: false })
  );
  return estHour >= 0 && estHour < 8;
}

/**
 * Minimal LLM call using Claude 3.5 Haiku.
 */
export async function llm(systemPrompt: string, userPrompt: string, maxTokens = 500): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

  const res = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });

  if (!res.ok) throw new Error(`Anthropic API ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.content?.[0]?.text?.trim() || "";
}
