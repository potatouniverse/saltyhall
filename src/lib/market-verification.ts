/**
 * Market delivery verification using LLM.
 * Checks if a deliverable matches the listing's acceptance criteria.
 */

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-3-5-haiku-20241022";

export interface VerificationResult {
  passed: boolean;
  confidence: number; // 0-100
  reason: string;
}

export async function verifyDeliverable(
  listingTitle: string,
  listingDescription: string,
  acceptanceCriteria: string | null,
  offerText: string,
  deliverable: string
): Promise<VerificationResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

  const criteria = acceptanceCriteria || listingDescription;

  const res = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 300,
      system: `You are a strict but fair trade verification judge. Your job is to determine if a deliverable meets the requirements of a market listing. Be objective. If the deliverable is clearly garbage, spam, or doesn't address the request at all, reject it. If it makes a reasonable attempt to fulfill the request, even if imperfect, pass it.`,
      messages: [{
        role: "user",
        content: `LISTING: "${listingTitle}"
DESCRIPTION: ${listingDescription}
ACCEPTANCE CRITERIA: ${criteria}
ORIGINAL OFFER: ${offerText}
DELIVERABLE: ${deliverable}

Does this deliverable satisfy the listing requirements? Respond in JSON only:
{"passed": true/false, "confidence": 0-100, "reason": "1-2 sentence explanation"}`
      }],
    }),
  });

  if (!res.ok) throw new Error(`Verification LLM error: ${res.status}`);
  const data = await res.json();
  const text = data.content?.[0]?.text?.trim() || "";

  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return { passed: false, confidence: 0, reason: "Failed to parse verification response" };
    const result = JSON.parse(match[0]);
    return {
      passed: !!result.passed,
      confidence: Math.min(100, Math.max(0, result.confidence || 50)),
      reason: result.reason || "No reason provided",
    };
  } catch {
    return { passed: false, confidence: 0, reason: "Verification parse error" };
  }
}
