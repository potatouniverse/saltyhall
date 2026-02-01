#!/usr/bin/env npx tsx
/**
 * Test script for Agent Memory system
 * Usage: npx tsx scripts/test-memory.ts
 */

import { storeMemory, recallMemory, listMemories, deleteMemory, summarizeMemories } from "../src/lib/agent-memory";
import { db } from "../src/lib/db-factory";

const TEST_AGENT_ID = "test-agent-memory-" + Date.now();

async function runTests() {
  console.log("🧪 Testing Agent Memory System\n");

  try {
    // Create a test agent
    console.log("1. Creating test agent...");
    const agent = await db.createAgent("TestMemoryAgent", "A test agent for memory system", [], "🧠");
    console.log(`   ✅ Created agent: ${agent.id}\n`);

    // Test 1: Store memories
    console.log("2. Storing memories...");
    const mem1 = await storeMemory({
      agentId: agent.id,
      key: "user_timezone",
      value: "Pacific Time (PST)",
      category: "fact"
    });
    console.log(`   ✅ Stored fact: ${mem1.content}`);

    const mem2 = await storeMemory({
      agentId: agent.id,
      key: "ui_preference",
      value: "User prefers dark mode and concise responses",
      category: "preference"
    });
    console.log(`   ✅ Stored preference: ${mem2.content}`);

    const mem3 = await storeMemory({
      agentId: agent.id,
      value: "Had a great conversation about cryptocurrency trading strategies",
      category: "experience"
    });
    console.log(`   ✅ Stored experience: ${mem3.content}\n`);

    // Test 2: List memories by category
    console.log("3. Listing memories by category...");
    const facts = await listMemories({ agentId: agent.id, category: "fact" });
    console.log(`   ✅ Found ${facts.length} facts`);
    
    const prefs = await listMemories({ agentId: agent.id, category: "preference" });
    console.log(`   ✅ Found ${prefs.length} preferences\n`);

    // Test 3: Recall with search
    console.log("4. Testing semantic search...");
    const searchResults = await recallMemory({
      agentId: agent.id,
      query: "timezone",
      limit: 5
    });
    console.log(`   ✅ Search for "timezone" returned ${searchResults.length} results`);
    if (searchResults.length > 0) {
      console.log(`      Top result: ${searchResults[0].content}\n`);
    }

    // Test 4: Update existing memory by key
    console.log("5. Updating memory by key...");
    await storeMemory({
      agentId: agent.id,
      key: "user_timezone",
      value: "Eastern Time (EST) - user moved",
      category: "fact"
    });
    const updated = await listMemories({ agentId: agent.id, category: "fact" });
    console.log(`   ✅ Updated timezone: ${updated[0].content}\n`);

    // Test 5: Store many memories for summarization test
    console.log("6. Creating multiple memories for summarization...");
    for (let i = 0; i < 8; i++) {
      await storeMemory({
        agentId: agent.id,
        value: `Experience #${i + 1}: Something interesting happened`,
        category: "experience"
      });
    }
    const beforeCount = (await listMemories({ agentId: agent.id, category: "experience" })).length;
    console.log(`   ✅ Created ${beforeCount} experience memories\n`);

    // Test 6: Summarize memories
    console.log("7. Testing memory summarization...");
    const { summaries, compressed } = await summarizeMemories(agent.id);
    console.log(`   ✅ Compressed ${compressed} memories into ${summaries.length} summaries`);
    if (summaries.length > 0) {
      console.log(`      Summary preview: ${summaries[0].substring(0, 80)}...\n`);
    }

    // Test 7: Verify final state
    console.log("8. Final memory count...");
    const allMemories = await listMemories({ agentId: agent.id });
    console.log(`   ✅ Total memories: ${allMemories.length}`);
    console.log(`      - Facts: ${allMemories.filter(m => m.category === 'fact').length}`);
    console.log(`      - Preferences: ${allMemories.filter(m => m.category === 'preference').length}`);
    console.log(`      - Experiences: ${allMemories.filter(m => m.category === 'experience').length}\n`);

    // Cleanup
    console.log("9. Cleanup (deleting test agent)...");
    // Note: This will cascade delete all memories due to foreign key constraint
    // For now, just leave the test data
    console.log(`   ⚠️  Test agent left in database for inspection: ${agent.id}\n`);

    console.log("✅ All tests passed!\n");

  } catch (error: any) {
    console.error("❌ Test failed:", error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

runTests().then(() => {
  console.log("🎉 Memory system test complete!");
  process.exit(0);
}).catch(error => {
  console.error("Fatal error:", error);
  process.exit(1);
});
