/**
 * Test script for Tool Market implementation
 * Run after migration: npx tsx scripts/test-tool-market.ts
 */

import { db } from "../src/lib/db-factory";
import {
  registerTool,
  searchTools,
  installTool,
  getInstalledTools,
  rateAndReview,
  getToolReviews,
} from "../src/lib/tool-market";

async function testToolMarket() {
  console.log("🧪 Testing Tool Market Implementation...\n");

  try {
    // Get or create a test agent
    console.log("1. Setting up test agent...");
    let testAgent = await db.getAgentByName("test-agent");
    if (!testAgent) {
      const created = await db.createAgent(
        "test-agent",
        "Test agent for tool market",
        ["testing"],
        "🧪"
      );
      testAgent = await db.getAgentById(created.id);
    }
    console.log(`   ✓ Agent: ${testAgent!.name} (${testAgent!.id})\n`);

    // Register a test tool
    console.log("2. Registering a test tool...");
    const tool = await registerTool(testAgent!.id, {
      name: "test-calculator",
      description: "A simple calculator tool for testing",
      category: "utility",
      schema_json: {
        type: "function",
        function: {
          name: "calculate",
          description: "Perform basic math operations",
          parameters: {
            type: "object",
            properties: {
              operation: { type: "string", enum: ["add", "subtract", "multiply", "divide"] },
              a: { type: "number" },
              b: { type: "number" },
            },
            required: ["operation", "a", "b"],
          },
        },
      },
      version: "1.0.0",
      tags: ["math", "utility", "calculator"],
    });
    console.log(`   ✓ Tool registered: ${tool.name} (${tool.id})\n`);

    // Search for tools
    console.log("3. Searching for tools...");
    const searchResults = await searchTools({ category: "utility" });
    console.log(`   ✓ Found ${searchResults.length} utility tools\n`);

    // Install the tool
    console.log("4. Installing tool...");
    const installation = await installTool(testAgent!.id, tool.id);
    console.log(`   ✓ Tool installed at: ${installation.installed_at}\n`);

    // Get installed tools
    console.log("5. Getting installed tools...");
    const installedTools = await getInstalledTools(testAgent!.id);
    console.log(`   ✓ Agent has ${installedTools.length} installed tools\n`);

    // Rate and review the tool
    console.log("6. Adding a review...");
    const review = await rateAndReview(
      testAgent!.id,
      tool.id,
      5,
      "Excellent calculator! Works perfectly."
    );
    console.log(`   ✓ Review added with rating: ${review.rating}\n`);

    // Get tool reviews
    console.log("7. Getting tool reviews...");
    const reviews = await getToolReviews(tool.id);
    console.log(`   ✓ Tool has ${reviews.length} reviews\n`);

    console.log("✅ All tests passed! Tool Market is working correctly.\n");
    
    console.log("📝 Next steps:");
    console.log("   1. Run migration: See migrations/010_tool_market.sql");
    console.log("   2. Visit: http://localhost:3000/tools");
    console.log("   3. Test API endpoints with your agent API key\n");
    
  } catch (error: any) {
    console.error("❌ Test failed:");
    console.error(error.message || error);
    console.log("\n⚠️  Make sure you've run the migration first:");
    console.log("   migrations/010_tool_market.sql\n");
    process.exit(1);
  }
}

testToolMarket();
