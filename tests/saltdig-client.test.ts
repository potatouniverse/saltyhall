/**
 * SaltDig Client Tests
 * 
 * These tests verify the SaltDig client works correctly.
 * Run with: npx tsx tests/saltdig-client.test.ts
 * 
 * For live tests, set SALTDIG_API_URL and a valid SALTDIG_TEST_API_KEY.
 * Without these, tests use mock responses.
 */

import { 
  SaltDigClient, 
  SaltDigError, 
  createClient, 
  healthCheck,
  getApiUrl,
  type WalletBalanceResponse,
  type NaclWalletResponse,
  type EscrowStatusResponse,
} from '../src/lib/saltdig-client';

// ══════════════════════════════════════════════════════════════════════════════
// Test Utilities
// ══════════════════════════════════════════════════════════════════════════════

const TEST_API_KEY = process.env.SALTDIG_TEST_API_KEY || 'test-api-key-xxx';
const IS_LIVE = !!process.env.SALTDIG_TEST_API_KEY && !!process.env.SALTDIG_API_URL;

let passed = 0;
let failed = 0;

function test(name: string, fn: () => Promise<void> | void) {
  return async () => {
    try {
      await fn();
      console.log(`✅ ${name}`);
      passed++;
    } catch (e: any) {
      console.log(`❌ ${name}`);
      console.log(`   Error: ${e.message}`);
      failed++;
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
    toBeInstanceOf(cls: any) {
      if (!(actual instanceof cls)) {
        throw new Error(`Expected instance of ${cls.name}`);
      }
    },
    toHaveProperty(prop: string) {
      if (typeof actual !== 'object' || actual === null || !(prop in actual)) {
        throw new Error(`Expected object with property '${prop}'`);
      }
    },
    toThrow() {
      // This is a special case - actual should be a function
      const fn = actual as unknown as () => void;
      let threw = false;
      try {
        fn();
      } catch {
        threw = true;
      }
      if (!threw) {
        throw new Error('Expected function to throw');
      }
    },
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Unit Tests
// ══════════════════════════════════════════════════════════════════════════════

const unitTests = [
  test('createClient returns SaltDigClient instance', () => {
    const client = createClient('test-key');
    expect(client).toBeInstanceOf(SaltDigClient);
  }),

  test('getApiUrl returns configured URL', () => {
    const url = getApiUrl();
    expect(typeof url).toBe('string');
    expect(url.startsWith('http')).toBeTruthy();
  }),

  test('SaltDigError has correct properties', () => {
    const error = new SaltDigError('test error', 400, 'TEST_CODE');
    expect(error.message).toBe('test error');
    expect(error.status).toBe(400);
    expect(error.code).toBe('TEST_CODE');
    expect(error.name).toBe('SaltDigError');
  }),

  test('SaltDigClient accepts API key in constructor', () => {
    const client = new SaltDigClient('my-api-key');
    // Client should be created without error
    expect(client).toBeTruthy();
  }),
];

// ══════════════════════════════════════════════════════════════════════════════
// Integration Tests (require live SaltDig)
// ══════════════════════════════════════════════════════════════════════════════

const integrationTests = IS_LIVE ? [
  test('[LIVE] healthCheck returns true for running SaltDig', async () => {
    const healthy = await healthCheck();
    expect(healthy).toBeTruthy();
  }),

  test('[LIVE] getNaclWallet returns balance', async () => {
    const client = createClient(TEST_API_KEY);
    const wallet = await client.getNaclWallet();
    expect(wallet).toHaveProperty('success');
    expect(wallet).toHaveProperty('balance');
    expect(typeof wallet.balance).toBe('number');
  }),

  test('[LIVE] getUsdcBalance returns balance info', async () => {
    const client = createClient(TEST_API_KEY);
    try {
      const balance = await client.getUsdcBalance();
      expect(balance).toHaveProperty('success');
      expect(balance).toHaveProperty('address');
    } catch (e: any) {
      // 404 is acceptable - means agent has no USDC wallet
      if (e.status !== 404) throw e;
      console.log('   (Agent has no USDC wallet - OK)');
    }
  }),

  test('[LIVE] getListings returns array', async () => {
    const client = createClient(TEST_API_KEY);
    const result = await client.getListings({ limit: 5 });
    expect(result).toHaveProperty('success');
    expect(result).toHaveProperty('listings');
    expect(Array.isArray(result.listings)).toBeTruthy();
  }),

  test('[LIVE] invalid API key returns 401', async () => {
    const client = createClient('invalid-key-xxx');
    let threw = false;
    try {
      await client.getNaclWallet();
    } catch (e: any) {
      threw = true;
      expect(e).toBeInstanceOf(SaltDigError);
      expect(e.status).toBe(401);
    }
    expect(threw).toBeTruthy();
  }),
] : [
  test('[SKIP] Integration tests skipped (set SALTDIG_TEST_API_KEY and SALTDIG_API_URL)', () => {
    console.log('   To run live tests:');
    console.log('   SALTDIG_API_URL=http://localhost:3001 SALTDIG_TEST_API_KEY=your-key npx tsx tests/saltdig-client.test.ts');
  }),
];

// ══════════════════════════════════════════════════════════════════════════════
// Mock Tests (test client behavior without live server)
// ══════════════════════════════════════════════════════════════════════════════

// Mock fetch for offline testing
const mockTests = !IS_LIVE ? [
  test('[MOCK] healthCheck returns false when server is down', async () => {
    // Save original env
    const originalUrl = process.env.SALTDIG_API_URL;
    process.env.SALTDIG_API_URL = 'http://localhost:59999'; // Non-existent port
    
    const healthy = await healthCheck();
    expect(healthy).toBeFalsy();
    
    // Restore
    process.env.SALTDIG_API_URL = originalUrl;
  }),
] : [];

// ══════════════════════════════════════════════════════════════════════════════
// Run Tests
// ══════════════════════════════════════════════════════════════════════════════

async function runTests() {
  console.log('\n🧪 SaltDig Client Tests\n');
  console.log(`Mode: ${IS_LIVE ? 'LIVE' : 'MOCK'}`);
  console.log(`API URL: ${getApiUrl()}\n`);
  console.log('─'.repeat(50));

  console.log('\n📦 Unit Tests:\n');
  for (const t of unitTests) await t();

  console.log('\n🌐 Integration Tests:\n');
  for (const t of integrationTests) await t();

  console.log('\n🎭 Mock Tests:\n');
  for (const t of mockTests) await t();

  console.log('\n' + '─'.repeat(50));
  console.log(`\n📊 Results: ${passed} passed, ${failed} failed\n`);
  
  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
