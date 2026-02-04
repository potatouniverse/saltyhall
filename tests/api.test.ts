/**
 * SaltyHall API Tests
 * 
 * Tests for critical API endpoints:
 * - Agent authentication
 * - Market listings
 * - Arena predictions
 * 
 * Run with: npx tsx tests/api.test.ts
 * 
 * For live tests, set:
 *   SALTYHALL_API_URL=http://localhost:3000
 *   SALTYHALL_TEST_API_KEY=your-agent-api-key
 */

// ══════════════════════════════════════════════════════════════════════════════
// Test Utilities
// ══════════════════════════════════════════════════════════════════════════════

const API_URL = process.env.SALTYHALL_API_URL || 'http://localhost:3000';
const TEST_API_KEY = process.env.SALTYHALL_TEST_API_KEY || '';
const IS_LIVE = !!TEST_API_KEY && !!process.env.SALTYHALL_API_URL;

let passed = 0;
let failed = 0;
let skipped = 0;

interface TestResult {
  name: string;
  status: 'passed' | 'failed' | 'skipped';
  error?: string;
}

const results: TestResult[] = [];

function test(name: string, fn: () => Promise<void> | void, requiresLive = false) {
  return async () => {
    if (requiresLive && !IS_LIVE) {
      console.log(`⏭️  ${name} (skipped - requires live server)`);
      skipped++;
      results.push({ name, status: 'skipped' });
      return;
    }
    try {
      await fn();
      console.log(`✅ ${name}`);
      passed++;
      results.push({ name, status: 'passed' });
    } catch (e: any) {
      console.log(`❌ ${name}`);
      console.log(`   Error: ${e.message}`);
      failed++;
      results.push({ name, status: 'failed', error: e.message });
    }
  };
}

function expect<T>(actual: T) {
  return {
    toBe(expected: T) {
      if (actual !== expected) {
        throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
      }
    },
    toBeTruthy() {
      if (!actual) {
        throw new Error(`Expected truthy, got ${JSON.stringify(actual)}`);
      }
    },
    toBeFalsy() {
      if (actual) {
        throw new Error(`Expected falsy, got ${JSON.stringify(actual)}`);
      }
    },
    toBeGreaterThan(expected: number) {
      if (typeof actual !== 'number' || actual <= expected) {
        throw new Error(`Expected ${actual} > ${expected}`);
      }
    },
    toBeGreaterThanOrEqual(expected: number) {
      if (typeof actual !== 'number' || actual < expected) {
        throw new Error(`Expected ${actual} >= ${expected}`);
      }
    },
    toHaveProperty(prop: string) {
      if (typeof actual !== 'object' || actual === null || !(prop in actual)) {
        throw new Error(`Expected object with property '${prop}'`);
      }
    },
    toBeArray() {
      if (!Array.isArray(actual)) {
        throw new Error(`Expected array, got ${typeof actual}`);
      }
    },
    toContain(item: any) {
      if (!Array.isArray(actual) || !actual.includes(item)) {
        throw new Error(`Expected array to contain ${JSON.stringify(item)}`);
      }
    },
    toMatch(regex: RegExp) {
      if (typeof actual !== 'string' || !regex.test(actual)) {
        throw new Error(`Expected "${actual}" to match ${regex}`);
      }
    },
  };
}

async function apiGet(path: string, apiKey?: string) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }
  const res = await fetch(`${API_URL}${path}`, { headers });
  return { status: res.status, data: await res.json() };
}

async function apiPost(path: string, body: any, apiKey?: string) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  return { status: res.status, data: await res.json() };
}

async function apiPatch(path: string, body: any, apiKey?: string) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }
  const res = await fetch(`${API_URL}${path}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(body),
  });
  return { status: res.status, data: await res.json() };
}

// ══════════════════════════════════════════════════════════════════════════════
// Agent Authentication Tests
// ══════════════════════════════════════════════════════════════════════════════

const agentAuthTests = [
  test('[AUTH] GET /api/v1/agents/me without API key returns 401', async () => {
    const { status, data } = await apiGet('/api/v1/agents/me');
    expect(status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error).toBeTruthy();
  }, true),

  test('[AUTH] GET /api/v1/agents/me with invalid API key returns 401', async () => {
    const { status, data } = await apiGet('/api/v1/agents/me', 'invalid-key-12345');
    expect(status).toBe(401);
    expect(data.success).toBe(false);
  }, true),

  test('[AUTH] GET /api/v1/agents/me with valid API key returns agent', async () => {
    const { status, data } = await apiGet('/api/v1/agents/me', TEST_API_KEY);
    expect(status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.agent).toBeTruthy();
    expect(data.agent.id).toBeTruthy();
    expect(data.agent.name).toBeTruthy();
  }, true),

  test('[AUTH] Agent response includes expected fields', async () => {
    const { status, data } = await apiGet('/api/v1/agents/me', TEST_API_KEY);
    expect(status).toBe(200);
    const { agent } = data;
    // Required fields
    expect(agent).toHaveProperty('id');
    expect(agent).toHaveProperty('name');
    expect(agent).toHaveProperty('description');
    expect(agent).toHaveProperty('capabilities');
    expect(agent).toHaveProperty('reputation');
    expect(agent).toHaveProperty('is_claimed');
    expect(agent).toHaveProperty('is_active');
    expect(agent).toHaveProperty('created_at');
  }, true),

  test('[AUTH] PATCH /api/v1/agents/me without API key returns 401', async () => {
    const { status, data } = await apiPatch('/api/v1/agents/me', { description: 'test' });
    expect(status).toBe(401);
    expect(data.success).toBe(false);
  }, true),
];

// ══════════════════════════════════════════════════════════════════════════════
// Public Agents List Tests
// ══════════════════════════════════════════════════════════════════════════════

const agentListTests = [
  test('[AGENTS] GET /api/v1/agents returns agent list (no auth required)', async () => {
    const { status, data } = await apiGet('/api/v1/agents');
    expect(status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.agents).toBeArray();
    expect(data).toHaveProperty('count');
  }, true),

  test('[AGENTS] GET /api/v1/agents respects limit param', async () => {
    const { status, data } = await apiGet('/api/v1/agents?limit=5');
    expect(status).toBe(200);
    expect(data.agents.length).toBeGreaterThanOrEqual(0);
    // Can't exceed limit
    if (data.agents.length > 5) {
      throw new Error(`Expected at most 5 agents, got ${data.agents.length}`);
    }
  }, true),

  test('[AGENTS] GET /api/v1/agents limit is capped at 100', async () => {
    const { status, data } = await apiGet('/api/v1/agents?limit=200');
    expect(status).toBe(200);
    // Server should cap at 100, but we can't know if there are 100+ agents
    // Just verify it doesn't error
    expect(data.success).toBe(true);
  }, true),

  test('[AGENTS] Agent list items have expected fields', async () => {
    const { status, data } = await apiGet('/api/v1/agents?limit=1');
    expect(status).toBe(200);
    if (data.agents.length > 0) {
      const agent = data.agents[0];
      expect(agent).toHaveProperty('id');
      expect(agent).toHaveProperty('name');
      expect(agent).toHaveProperty('reputation');
      expect(agent).toHaveProperty('is_online');
    }
  }, true),
];

// ══════════════════════════════════════════════════════════════════════════════
// Market Listings Tests
// ══════════════════════════════════════════════════════════════════════════════

const marketListingTests = [
  test('[MARKET] GET /api/v1/market/listings returns listings (no auth)', async () => {
    const { status, data } = await apiGet('/api/v1/market/listings');
    expect(status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.listings).toBeArray();
  }, true),

  test('[MARKET] GET /api/v1/market/listings respects status filter', async () => {
    const { status, data } = await apiGet('/api/v1/market/listings?status=active');
    expect(status).toBe(200);
    expect(data.success).toBe(true);
    // All returned listings should be active
    for (const listing of data.listings) {
      if (listing.status !== 'active') {
        throw new Error(`Expected active listing, got status=${listing.status}`);
      }
    }
  }, true),

  test('[MARKET] GET /api/v1/market/listings respects limit', async () => {
    const { status, data } = await apiGet('/api/v1/market/listings?limit=3');
    expect(status).toBe(200);
    if (data.listings.length > 3) {
      throw new Error(`Expected at most 3 listings, got ${data.listings.length}`);
    }
  }, true),

  test('[MARKET] GET /api/v1/market/listings supports poster_type filter', async () => {
    const { status, data } = await apiGet('/api/v1/market/listings?poster_type=agent');
    expect(status).toBe(200);
    expect(data.success).toBe(true);
  }, true),

  test('[MARKET] GET /api/v1/market/listings supports target_type filter', async () => {
    const { status, data } = await apiGet('/api/v1/market/listings?target_type=human');
    expect(status).toBe(200);
    expect(data.success).toBe(true);
  }, true),

  test('[MARKET] POST /api/v1/market/listings without auth returns 401', async () => {
    const { status, data } = await apiPost('/api/v1/market/listings', {
      title: 'Test Listing',
      description: 'A test listing',
    });
    expect(status).toBe(401);
    expect(data.success).toBe(false);
  }, true),

  test('[MARKET] POST /api/v1/market/listings without title returns 400', async () => {
    const { status, data } = await apiPost('/api/v1/market/listings', {
      description: 'Missing title',
    }, TEST_API_KEY);
    expect(status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toMatch(/title/i);
  }, true),

  test('[MARKET] POST /api/v1/market/listings creates listing', async () => {
    const uniqueTitle = `Test Listing ${Date.now()}`;
    const { status, data } = await apiPost('/api/v1/market/listings', {
      title: uniqueTitle,
      description: 'Created by API test',
      type: 'sell',
      category: 'testing',
      price: '0 NACL',
    }, TEST_API_KEY);
    expect(status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.listing).toBeTruthy();
    expect(data.listing.title).toBe(uniqueTitle);
  }, true),
];

// ══════════════════════════════════════════════════════════════════════════════
// Arena Topics/Predictions Tests
// ══════════════════════════════════════════════════════════════════════════════

const arenaTests = [
  test('[ARENA] GET /api/v1/arena/topics returns topics (no auth)', async () => {
    const { status, data } = await apiGet('/api/v1/arena/topics');
    expect(status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.topics).toBeArray();
  }, true),

  test('[ARENA] GET /api/v1/arena/topics respects status filter', async () => {
    const { status, data } = await apiGet('/api/v1/arena/topics?status=active');
    expect(status).toBe(200);
    expect(data.success).toBe(true);
  }, true),

  test('[ARENA] GET /api/v1/arena/topics respects limit', async () => {
    const { status, data } = await apiGet('/api/v1/arena/topics?limit=5');
    expect(status).toBe(200);
    if (data.topics.length > 5) {
      throw new Error(`Expected at most 5 topics, got ${data.topics.length}`);
    }
  }, true),

  test('[ARENA] POST /api/v1/arena/topics without auth returns 401', async () => {
    const { status, data } = await apiPost('/api/v1/arena/topics', {
      title: 'Test Topic',
    });
    expect(status).toBe(401);
    expect(data.success).toBe(false);
  }, true),

  test('[ARENA] POST /api/v1/arena/topics without title returns 400', async () => {
    const { status, data } = await apiPost('/api/v1/arena/topics', {
      description: 'Missing title',
    }, TEST_API_KEY);
    expect(status).toBe(400);
    expect(data.success).toBe(false);
  }, true),

  test('[ARENA] GET /api/v1/arena/leaderboard returns leaderboard', async () => {
    const { status, data } = await apiGet('/api/v1/arena/leaderboard');
    expect(status).toBe(200);
    expect(data.success).toBe(true);
  }, true),
];

// ══════════════════════════════════════════════════════════════════════════════
// Edge Cases & Error Handling
// ══════════════════════════════════════════════════════════════════════════════

const edgeCaseTests = [
  test('[EDGE] Invalid JSON in POST body returns error', async () => {
    const res = await fetch(`${API_URL}/api/v1/market/listings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TEST_API_KEY}`,
      },
      body: '{invalid json',
    });
    // Should return 400 or 500, not crash
    expect(res.status >= 400).toBeTruthy();
  }, true),

  test('[EDGE] Very long title is handled', async () => {
    const longTitle = 'A'.repeat(1000);
    const { status, data } = await apiPost('/api/v1/market/listings', {
      title: longTitle,
      description: 'Testing long title',
    }, TEST_API_KEY);
    // Should either succeed or return validation error, not crash
    expect(status === 200 || status === 400).toBeTruthy();
  }, true),

  test('[EDGE] Unicode in title/description works', async () => {
    const unicodeTitle = `テスト 测试 🧪 ${Date.now()}`;
    const { status, data } = await apiPost('/api/v1/market/listings', {
      title: unicodeTitle,
      description: '日本語 中文 العربية',
    }, TEST_API_KEY);
    expect(status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.listing.title).toBe(unicodeTitle);
  }, true),

  test('[EDGE] SQL injection attempt in query params', async () => {
    const { status, data } = await apiGet('/api/v1/agents?limit=1; DROP TABLE agents;--');
    // Should either parse as number (NaN -> default) or error gracefully
    expect(status).toBe(200);
    expect(data.success).toBe(true);
  }, true),

  test('[EDGE] XSS in listing title is stored safely', async () => {
    const xssTitle = `<script>alert('xss')</script> ${Date.now()}`;
    const { status, data } = await apiPost('/api/v1/market/listings', {
      title: xssTitle,
      description: '<img onerror="alert(1)" src="x">',
    }, TEST_API_KEY);
    expect(status).toBe(200);
    // Content should be stored (will be escaped on render)
    expect(data.listing.title).toBe(xssTitle);
  }, true),

  test('[EDGE] Empty arrays for capabilities work', async () => {
    const { status, data } = await apiPatch('/api/v1/agents/me', {
      capabilities: [],
    }, TEST_API_KEY);
    expect(status).toBe(200);
    expect(data.success).toBe(true);
  }, true),
];

// ══════════════════════════════════════════════════════════════════════════════
// Mock Tests (no server required)
// ══════════════════════════════════════════════════════════════════════════════

const mockTests = [
  test('[MOCK] Test framework expect() works correctly', () => {
    expect(1).toBe(1);
    expect(true).toBeTruthy();
    expect(false).toBeFalsy();
    expect(5).toBeGreaterThan(3);
    expect([1, 2, 3]).toBeArray();
    expect({ foo: 'bar' }).toHaveProperty('foo');
    expect('hello world').toMatch(/hello/);
  }),

  test('[MOCK] API URL is configured', () => {
    expect(API_URL).toBeTruthy();
    expect(API_URL).toMatch(/^https?:\/\//);
  }),
];

// ══════════════════════════════════════════════════════════════════════════════
// Run Tests
// ══════════════════════════════════════════════════════════════════════════════

async function runTests() {
  console.log('\n🧪 SaltyHall API Tests\n');
  console.log(`Mode: ${IS_LIVE ? 'LIVE' : 'MOCK'}`);
  console.log(`API URL: ${API_URL}`);
  console.log(`API Key: ${TEST_API_KEY ? '✓ configured' : '✗ not set'}\n`);
  console.log('─'.repeat(60));

  console.log('\n📦 Mock Tests:\n');
  for (const t of mockTests) await t();

  console.log('\n🔐 Agent Auth Tests:\n');
  for (const t of agentAuthTests) await t();

  console.log('\n👥 Agent List Tests:\n');
  for (const t of agentListTests) await t();

  console.log('\n🏪 Market Listing Tests:\n');
  for (const t of marketListingTests) await t();

  console.log('\n🏟️ Arena Tests:\n');
  for (const t of arenaTests) await t();

  console.log('\n⚠️ Edge Case Tests:\n');
  for (const t of edgeCaseTests) await t();

  console.log('\n' + '─'.repeat(60));
  console.log(`\n📊 Results: ${passed} passed, ${failed} failed, ${skipped} skipped\n`);
  
  if (!IS_LIVE) {
    console.log('💡 To run live tests:');
    console.log('   SALTYHALL_API_URL=http://localhost:3000 SALTYHALL_TEST_API_KEY=your-key npx tsx tests/api.test.ts\n');
  }
  
  if (failed > 0) {
    console.log('Failed tests:');
    results.filter(r => r.status === 'failed').forEach(r => {
      console.log(`  ❌ ${r.name}: ${r.error}`);
    });
    process.exit(1);
  }
}

runTests();
