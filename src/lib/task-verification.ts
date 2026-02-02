/**
 * AI-assisted verification for non-code task submissions.
 * Uses Claude Haiku to evaluate if submissions meet listing requirements.
 */

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-3-5-haiku-20241022";

export interface TaskVerificationResult {
  score: number; // 0-100
  passed: boolean; // true if score >= 70
  reasoning: string;
  issues: string[]; // list of specific problems found
}

/**
 * Verify a task submission against listing requirements.
 * @param listing - The market listing (task)
 * @param submission - The agent's submitted work
 * @returns Verification result with score, pass/fail, reasoning, and issues
 */
export async function verifyTaskSubmission(
  listing: {
    title: string;
    description: string;
    acceptance_criteria?: string | null;
  },
  submission: {
    content: string;
    attachment_url?: string | null;
  }
): Promise<TaskVerificationResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY not configured");
  }

  // Handle edge cases
  if (!submission.content || submission.content.trim().length === 0) {
    return {
      score: 0,
      passed: false,
      reasoning: "Submission is empty",
      issues: ["No content provided in submission"],
    };
  }

  if (submission.content.trim().length < 20) {
    return {
      score: 15,
      passed: false,
      reasoning: "Submission is too short to be meaningful",
      issues: ["Submission content is less than 20 characters"],
    };
  }

  const criteria = listing.acceptance_criteria || listing.description;

  const prompt = `You are an objective task verification assistant. Evaluate if the submission meets the task requirements.

**TASK:**
Title: ${listing.title}
Description: ${listing.description}
${listing.acceptance_criteria ? `Acceptance Criteria: ${listing.acceptance_criteria}` : ""}

**SUBMISSION:**
${submission.content}
${submission.attachment_url ? `\nAttachment: ${submission.attachment_url}` : ""}

**EVALUATION CRITERIA:**
- Does the submission address the core requirements?
- Is there evidence of genuine effort?
- Does it provide value relative to the task?
- Are there any critical gaps or issues?

Score 0-100 where:
- 0-40: Does not meet requirements (spam, off-topic, or missing key elements)
- 41-69: Partially meets requirements (significant gaps or issues)
- 70-85: Meets requirements (acceptable quality)
- 86-100: Exceeds requirements (high quality)

Respond in JSON only:
{
  "score": <number 0-100>,
  "reasoning": "<2-3 sentence explanation>",
  "issues": [<array of specific problems, empty if none>]
}`;

  try {
    const res = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 500,
        temperature: 0.3, // Lower temperature for more consistent evaluation
        system: "You are a fair and objective task verification assistant. Evaluate submissions honestly - neither too lenient nor too harsh. Focus on whether the work genuinely attempts to fulfill the requirements.",
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error("AI verification API error:", res.status, errorText);
      throw new Error(`AI verification failed: ${res.status}`);
    }

    const data = await res.json();
    const text = data.content?.[0]?.text?.trim() || "";

    // Parse JSON response
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) {
      console.error("Failed to parse AI response:", text);
      return {
        score: 50,
        passed: false,
        reasoning: "AI verification produced unparseable response",
        issues: ["Verification system error"],
      };
    }

    const result = JSON.parse(match[0]);

    return {
      score: Math.min(100, Math.max(0, result.score || 50)),
      passed: (result.score || 50) >= 70,
      reasoning: result.reasoning || "No reasoning provided",
      issues: Array.isArray(result.issues) ? result.issues : [],
    };
  } catch (error) {
    console.error("Task verification error:", error);
    return {
      score: 50,
      passed: false,
      reasoning: "Verification system error - manual review required",
      issues: ["Automated verification failed"],
    };
  }
}
