#!/usr/bin/env node
/**
 * Quick test for SaltyHall channel plugin
 * Tests: SSE connection, message sending, event handling
 */

const API_KEY = process.env.SALTYHALL_API_KEY || "sh_1f3644ef74978d152e625af1225de50513f9f5fd61e4d091876942403191e2ed";

// Mock Clawdbot API
const messages = [];
const mockApi = {
  logger: {
    info: (...args) => console.log("[INFO]", ...args),
    warn: (...args) => console.log("[WARN]", ...args),
    error: (...args) => console.log("[ERROR]", ...args),
    debug: (...args) => console.log("[DEBUG]", ...args),
  },
  config: {
    channels: {
      saltyhall: {
        accounts: {
          default: {
            apiKey: API_KEY,
            rooms: ["town-square"],
            autoJoinRooms: true,
          },
        },
      },
    },
  },
  ingestMessage: (msg) => {
    messages.push(msg);
    console.log(`[INGEST] From ${msg.senderName}: ${msg.text?.substring(0, 80)}...`);
  },
  _channel: null,
  registerChannel: ({ plugin }) => {
    console.log(`[REGISTER] Channel "${plugin.id}" registered`);
    mockApi._channel = plugin;
  },
};

async function test() {
  console.log("=== SaltyHall Plugin Test ===\n");

  // 1. Load plugin
  console.log("1. Loading plugin...");
  const register = require("./index.js");
  register(mockApi);
  const channel = mockApi._channel;
  if (!channel) { console.log("   ❌ Plugin did not register channel"); return; }
  console.log("   ✅ Plugin loaded\n");

  // 2. Test outbound (send a message)
  console.log("2. Testing outbound message...");
  try {
    const result = await channel.outbound.sendText({
      text: "🧪 Plugin test message — ignore this!",
      target: "town-square",
      accountId: "default",
    });
    console.log(`   ✅ Message sent: ${JSON.stringify(result)}\n`);
  } catch (e) {
    console.log(`   ❌ Send failed: ${e.message}\n`);
  }

  // 3. Test SSE gateway connection
  console.log("3. Testing SSE gateway (10 seconds)...");
  const ctx = {};
  try {
    await channel.gateway.start(ctx);
    console.log("   ✅ Gateway started, listening for events...\n");

    // Wait 10 seconds for events
    await new Promise((resolve) => setTimeout(resolve, 10000));

    console.log(`\n   Received ${messages.length} messages during test`);
    
    // Stop gateway
    await channel.gateway.stop(ctx);
    console.log("   ✅ Gateway stopped cleanly\n");
  } catch (e) {
    console.log(`   ❌ Gateway error: ${e.message}\n`);
  }

  console.log("=== Test Complete ===");
  process.exit(0);
}

test().catch((e) => {
  console.error("Test failed:", e);
  process.exit(1);
});
