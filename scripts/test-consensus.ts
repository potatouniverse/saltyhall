/**
 * Test script for multi-person consensus system.
 * Run with: npx ts-node scripts/test-consensus.ts
 */

import { evaluateConsensus, calculatePayouts, type Submission } from "../src/lib/consensus";

async function runTests() {
  console.log("🧪 Testing Multi-Person Consensus System\n");

  // Test 1: 3 workers, 2 agree (should pass with 67% threshold)
  console.log("Test 1: 3 workers, 2 agree (exact match)");
  const submissions1: Submission[] = [
    { id: "1", slot_number: 1, worker_id: "worker-a", worker_type: "agent", content: "The answer is 42" },
    { id: "2", slot_number: 2, worker_id: "worker-b", worker_type: "agent", content: "The answer is 42" },
    { id: "3", slot_number: 3, worker_id: "worker-c", worker_type: "human", content: "The answer is 100" },
  ];
  const result1 = await evaluateConsensus(submissions1, "exact");
  console.log(`  Achieved: ${result1.achieved}`);
  console.log(`  Agreement: ${(result1.agreementRatio * 100).toFixed(0)}%`);
  console.log(`  Agreeing: ${result1.agreeingWorkers.join(", ")}`);
  console.log(`  Outliers: ${result1.outlierWorkers.join(", ")}`);
  console.log(`  Final answer: ${result1.finalAnswer}`);
  console.log(`  ✅ Test 1 ${result1.achieved && result1.agreeingWorkers.length === 2 ? "PASSED" : "FAILED"}\n`);

  // Test 2: 3 workers, all different (should fail)
  console.log("Test 2: 3 workers, all different (exact match)");
  const submissions2: Submission[] = [
    { id: "1", slot_number: 1, worker_id: "worker-a", worker_type: "agent", content: "Answer A" },
    { id: "2", slot_number: 2, worker_id: "worker-b", worker_type: "agent", content: "Answer B" },
    { id: "3", slot_number: 3, worker_id: "worker-c", worker_type: "human", content: "Answer C" },
  ];
  const result2 = await evaluateConsensus(submissions2, "exact");
  console.log(`  Achieved: ${result2.achieved}`);
  console.log(`  Agreement: ${(result2.agreementRatio * 100).toFixed(0)}%`);
  console.log(`  ✅ Test 2 ${!result2.achieved ? "PASSED" : "FAILED"}\n`);

  // Test 3: 3 workers, all agree (should pass with 100%)
  console.log("Test 3: 3 workers, all agree (exact match)");
  const submissions3: Submission[] = [
    { id: "1", slot_number: 1, worker_id: "worker-a", worker_type: "agent", content: "Consensus!" },
    { id: "2", slot_number: 2, worker_id: "worker-b", worker_type: "agent", content: "Consensus!" },
    { id: "3", slot_number: 3, worker_id: "worker-c", worker_type: "human", content: "Consensus!" },
  ];
  const result3 = await evaluateConsensus(submissions3, "exact");
  console.log(`  Achieved: ${result3.achieved}`);
  console.log(`  Agreement: ${(result3.agreementRatio * 100).toFixed(0)}%`);
  console.log(`  ✅ Test 3 ${result3.achieved && result3.agreementRatio === 1 ? "PASSED" : "FAILED"}\n`);

  // Test 4: Payout calculation
  console.log("Test 4: Payout calculation");
  const totalBounty = 100;
  const consensusCount = 3;
  const payouts = calculatePayouts(totalBounty, consensusCount, result1);
  console.log("  Payouts:");
  for (const [worker, amount] of payouts) {
    console.log(`    ${worker}: $${amount.toFixed(2)}`);
  }
  const totalPaid = Array.from(payouts.values()).reduce((a, b) => a + b, 0);
  console.log(`  Total paid: $${totalPaid.toFixed(2)}`);
  console.log(`  ✅ Test 4 ${totalPaid <= totalBounty ? "PASSED" : "FAILED"}\n`);

  // Test 5: Semantic comparison (requires API key)
  if (process.env.ANTHROPIC_API_KEY) {
    console.log("Test 5: Semantic comparison");
    const submissions5: Submission[] = [
      { id: "1", slot_number: 1, worker_id: "worker-a", worker_type: "agent", content: "The capital of France is Paris." },
      { id: "2", slot_number: 2, worker_id: "worker-b", worker_type: "agent", content: "Paris is the capital city of France." },
      { id: "3", slot_number: 3, worker_id: "worker-c", worker_type: "human", content: "The capital is London." },
    ];
    const result5 = await evaluateConsensus(submissions5, "semantic");
    console.log(`  Achieved: ${result5.achieved}`);
    console.log(`  Agreement: ${(result5.agreementRatio * 100).toFixed(0)}%`);
    console.log(`  Agreeing: ${result5.agreeingWorkers.join(", ")}`);
    console.log(`  Outliers: ${result5.outlierWorkers.join(", ")}`);
    console.log(`  ✅ Test 5 ${result5.achieved && result5.agreeingWorkers.length === 2 ? "PASSED" : "FAILED"}\n`);
  } else {
    console.log("Test 5: Skipped (no ANTHROPIC_API_KEY)\n");
  }

  console.log("🎉 All tests completed!");
}

runTests().catch(console.error);
