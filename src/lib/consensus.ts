/**
 * Multi-person consensus system for task verification.
 * Compares submissions from multiple workers to achieve consensus.
 */

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-3-5-haiku-20241022";

export interface Submission {
  id: string;
  slot_number: number;
  worker_id: string;
  worker_type: "agent" | "human";
  content: string;
  attachment_url?: string | null;
}

export interface ConsensusResult {
  achieved: boolean;
  agreementRatio: number;  // 0-1, e.g., 0.67 for 2/3 agreement
  finalAnswer: string | null;
  agreeingWorkers: string[];  // worker IDs that agreed
  outlierWorkers: string[];   // worker IDs that were outliers
  comparisons: ComparisonDetail[];  // detailed comparison results
}

export interface ComparisonDetail {
  worker1: string;
  worker2: string;
  similarity: number;  // 0-1
  reasoning: string;
}

/**
 * Evaluate consensus among multiple submissions.
 * @param submissions - Array of worker submissions
 * @param comparisonMethod - 'exact' for structured data, 'semantic' for LLM comparison
 * @param threshold - Minimum agreement ratio (default 2/3 = 0.666...)
 */
export async function evaluateConsensus(
  submissions: Submission[],
  comparisonMethod: "exact" | "semantic" = "exact",
  threshold: number = 2 / 3
): Promise<ConsensusResult> {
  if (submissions.length < 2) {
    // Single submission - auto-pass (no consensus needed)
    return {
      achieved: true,
      agreementRatio: 1,
      finalAnswer: submissions[0]?.content || null,
      agreeingWorkers: submissions.map((s) => s.worker_id),
      outlierWorkers: [],
      comparisons: [],
    };
  }

  // Build similarity matrix
  const n = submissions.length;
  const similarities: number[][] = Array(n)
    .fill(null)
    .map(() => Array(n).fill(1));
  const comparisons: ComparisonDetail[] = [];

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const sim =
        comparisonMethod === "exact"
          ? compareExact(submissions[i].content, submissions[j].content)
          : await compareSemantic(submissions[i].content, submissions[j].content);

      similarities[i][j] = sim.similarity;
      similarities[j][i] = sim.similarity;
      comparisons.push({
        worker1: submissions[i].worker_id,
        worker2: submissions[j].worker_id,
        similarity: sim.similarity,
        reasoning: sim.reasoning,
      });
    }
  }

  // Find the largest agreeing cluster
  const clusterResult = findLargestAgreeingCluster(submissions, similarities, 0.7);

  // Determine if consensus achieved
  const agreementRatio = clusterResult.agreeingWorkers.length / n;
  const achieved = agreementRatio >= threshold;

  // Final answer is the content from the largest cluster (or first agreeing worker)
  const agreeingSubmission = submissions.find(
    (s) => clusterResult.agreeingWorkers.includes(s.worker_id)
  );

  return {
    achieved,
    agreementRatio,
    finalAnswer: achieved ? agreeingSubmission?.content || null : null,
    agreeingWorkers: clusterResult.agreeingWorkers,
    outlierWorkers: clusterResult.outlierWorkers,
    comparisons,
  };
}

/**
 * Exact comparison for structured data.
 * Normalizes whitespace and compares strings.
 * For "exact" mode, only exact matches count as agreement.
 */
function compareExact(
  content1: string,
  content2: string
): { similarity: number; reasoning: string } {
  const normalize = (s: string) =>
    s
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();

  const n1 = normalize(content1);
  const n2 = normalize(content2);

  if (n1 === n2) {
    return { similarity: 1, reasoning: "Exact match after normalization" };
  }

  // Try JSON comparison if both are valid JSON
  try {
    const j1 = JSON.parse(content1);
    const j2 = JSON.parse(content2);
    if (JSON.stringify(j1) === JSON.stringify(j2)) {
      return { similarity: 1, reasoning: "Exact match as JSON" };
    }
  } catch {
    // Not JSON, continue with string comparison
  }

  // For "exact" mode, if not exact match, calculate similarity but it won't count as agreement
  // Use a high threshold (0.95) for near-exact matches (typos only)
  const distance = levenshteinDistance(n1, n2);
  const maxLen = Math.max(n1.length, n2.length);
  const rawSimilarity = maxLen > 0 ? 1 - distance / maxLen : 1;

  // Only consider as "agreeing" if similarity is very high (>95% = typo level)
  // Otherwise return low similarity to mark as different
  if (rawSimilarity >= 0.95) {
    return {
      similarity: rawSimilarity,
      reasoning: `Near-exact match: ${(rawSimilarity * 100).toFixed(1)}%`,
    };
  }

  // Different answers - return actual similarity but below threshold
  return {
    similarity: rawSimilarity * 0.5, // Scale down to ensure it's below 0.7 threshold
    reasoning: `Different content: ${(rawSimilarity * 100).toFixed(1)}% similar`,
  };
}

/**
 * Semantic comparison using LLM.
 */
async function compareSemantic(
  content1: string,
  content2: string
): Promise<{ similarity: number; reasoning: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("ANTHROPIC_API_KEY not configured, falling back to exact match");
    return compareExact(content1, content2);
  }

  const prompt = `Compare these two task submissions and determine if they express the same answer/result.

**Submission 1:**
${content1.slice(0, 2000)}

**Submission 2:**
${content2.slice(0, 2000)}

Evaluate semantic similarity:
- 1.0 = Essentially the same answer (minor wording differences OK)
- 0.7-0.9 = Same core answer with some differences
- 0.4-0.6 = Partially overlapping answers
- 0.1-0.3 = Different answers with minor overlap
- 0.0 = Completely different/contradictory answers

Respond in JSON only:
{
  "similarity": <number 0-1>,
  "reasoning": "<brief explanation>"
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
        max_tokens: 300,
        temperature: 0.1,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) {
      console.error("Semantic comparison API error:", res.status);
      return compareExact(content1, content2);
    }

    const data = await res.json();
    const text = data.content?.[0]?.text?.trim() || "";
    const match = text.match(/\{[\s\S]*\}/);

    if (match) {
      const result = JSON.parse(match[0]);
      return {
        similarity: Math.min(1, Math.max(0, result.similarity || 0.5)),
        reasoning: result.reasoning || "Semantic comparison",
      };
    }
  } catch (error) {
    console.error("Semantic comparison failed:", error);
  }

  // Fallback to exact
  return compareExact(content1, content2);
}

/**
 * Find the largest cluster of agreeing workers.
 * Uses greedy clustering based on similarity threshold.
 */
function findLargestAgreeingCluster(
  submissions: Submission[],
  similarities: number[][],
  simThreshold: number = 0.7
): { agreeingWorkers: string[]; outlierWorkers: string[] } {
  const n = submissions.length;

  // Build adjacency list (workers that agree with each other)
  const agrees: Set<number>[] = submissions.map(() => new Set());
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (similarities[i][j] >= simThreshold) {
        agrees[i].add(j);
        agrees[j].add(i);
      }
    }
  }

  // Find largest clique (simplified: greedy from each node)
  let bestCluster: number[] = [];

  for (let start = 0; start < n; start++) {
    const cluster = [start];
    for (let candidate = 0; candidate < n; candidate++) {
      if (candidate === start) continue;

      // Check if candidate agrees with all current cluster members
      const agreesWithAll = cluster.every((member) =>
        agrees[member].has(candidate)
      );
      if (agreesWithAll) {
        cluster.push(candidate);
      }
    }

    if (cluster.length > bestCluster.length) {
      bestCluster = cluster;
    }
  }

  const agreeingWorkers = bestCluster.map((i) => submissions[i].worker_id);
  const outlierWorkers = submissions
    .filter((_, i) => !bestCluster.includes(i))
    .map((s) => s.worker_id);

  return { agreeingWorkers, outlierWorkers };
}

/**
 * Levenshtein distance for string similarity.
 */
function levenshteinDistance(s1: string, s2: string): number {
  const m = s1.length;
  const n = s2.length;
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (s1[i - 1] === s2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }

  return dp[m][n];
}

/**
 * Calculate payout distribution for consensus result.
 * @param totalBounty - Total bounty for the task
 * @param consensusCount - Expected number of workers
 * @param result - Consensus evaluation result
 * @returns Map of worker_id -> payout amount
 */
export function calculatePayouts(
  totalBounty: number,
  consensusCount: number,
  result: ConsensusResult
): Map<string, number> {
  const payouts = new Map<string, number>();

  if (!result.achieved) {
    // Consensus not achieved - no payouts
    for (const worker of [...result.agreeingWorkers, ...result.outlierWorkers]) {
      payouts.set(worker, 0);
    }
    return payouts;
  }

  // Base payout per worker
  const basePerWorker = totalBounty / consensusCount;

  // Outlier stakes go to agreeing workers as bonus
  const outlierCount = result.outlierWorkers.length;
  const outlierStakeTotal = outlierCount * (basePerWorker * 0.1); // 10% stake from outliers
  const bonusPerAgreeing =
    result.agreeingWorkers.length > 0
      ? outlierStakeTotal / result.agreeingWorkers.length
      : 0;

  // Agreeing workers get base + bonus
  for (const worker of result.agreeingWorkers) {
    payouts.set(worker, basePerWorker + bonusPerAgreeing);
  }

  // Outliers get nothing
  for (const worker of result.outlierWorkers) {
    payouts.set(worker, 0);
  }

  return payouts;
}
