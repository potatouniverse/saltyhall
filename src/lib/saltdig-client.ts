/**
 * Saltdig Client - SDK for integrating with Saltdig payment infrastructure
 * 
 * This client provides a type-safe interface to interact with Saltdig API,
 * similar to how applications integrate with Stripe.
 */

const SALTDIG_BASE_URL = process.env.SALTDIG_API_URL || 'http://localhost:3001';
const SALTDIG_API_KEY = process.env.SALTDIG_API_KEY || '';

interface SaltdigResponse<T> {
  success: boolean;
  data: T | null;
  error: {
    code: string;
    message: string;
    details?: unknown;
  } | null;
  timestamp: string;
}

interface Wallet {
  agentId: string;
  saltBalance: number;
  usdcBalance: number;
  usdcAddress: string | null;
}

interface Bounty {
  id: string;
  createdBy: string;
  title: string;
  description: string;
  budget: number;
  currency: 'SALT' | 'USDC';
  status: 'open' | 'claimed' | 'in_progress' | 'completed' | 'disputed';
  claimedBy: string | null;
  specFrozen: boolean;
  specDeposit: number | null;
  bountyGraph: object | null;
  milestones?: Milestone[];
  createdAt: string;
  updatedAt: string;
}

interface Milestone {
  id: string;
  listingId: string;
  title: string;
  description: string;
  budget: number;
  status: 'pending' | 'started' | 'submitted' | 'approved' | 'rejected';
  startedAt: string | null;
  submittedAt: string | null;
  order: number;
}

interface CreateBountyParams {
  title: string;
  description: string;
  budget: number;
  currency: 'SALT' | 'USDC';
  agentId: string;
  bountyGraph?: object;
  milestones?: Array<{
    title: string;
    description: string;
    budget: number;
    order: number;
  }>;
}

interface TransferParams {
  fromAgentId: string;
  toAgentId: string;
  amount: number;
  currency: 'SALT' | 'USDC';
  reason?: string;
}

/**
 * Make authenticated request to Saltdig API
 */
async function saltdigRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<SaltdigResponse<T>> {
  const url = `${SALTDIG_BASE_URL}${endpoint}`;
  
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SALTDIG_API_KEY}`,
      ...options.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`Saltdig API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

// ============================================================================
// WALLET API
// ============================================================================

/**
 * Get wallet balance for an agent
 */
export async function getWalletBalance(agentId: string): Promise<Wallet> {
  const result = await saltdigRequest<Wallet>(`/api/v1/wallet?agentId=${agentId}`);
  
  if (!result.success || !result.data) {
    throw new Error(result.error?.message || 'Failed to get wallet balance');
  }
  
  return result.data;
}

/**
 * Get USDC balance for an agent
 */
export async function getUSDCBalance(agentId: string): Promise<number> {
  const result = await saltdigRequest<{ balance: number }>(`/api/v1/wallet/usdc?agentId=${agentId}`);
  
  if (!result.success || !result.data) {
    throw new Error(result.error?.message || 'Failed to get USDC balance');
  }
  
  return result.data.balance;
}

/**
 * Get USDC deposit address for an agent
 */
export async function getUSDCAddress(agentId: string): Promise<string> {
  const result = await saltdigRequest<{ address: string }>(`/api/v1/wallet/usdc/address?agentId=${agentId}`);
  
  if (!result.success || !result.data) {
    throw new Error(result.error?.message || 'Failed to get USDC address');
  }
  
  return result.data.address;
}

/**
 * Transfer funds between agents
 */
export async function transferFunds(params: TransferParams): Promise<void> {
  const result = await saltdigRequest<void>('/api/v1/wallet/transfer', {
    method: 'POST',
    body: JSON.stringify(params),
  });
  
  if (!result.success) {
    throw new Error(result.error?.message || 'Failed to transfer funds');
  }
}

// ============================================================================
// MARKET API
// ============================================================================

/**
 * Get all bounties
 */
export async function getBounties(filters?: {
  status?: string;
  currency?: 'SALT' | 'USDC';
  createdBy?: string;
}): Promise<Bounty[]> {
  const params = new URLSearchParams(filters as Record<string, string>);
  const result = await saltdigRequest<Bounty[]>(`/api/v1/market/listings?${params}`);
  
  if (!result.success || !result.data) {
    throw new Error(result.error?.message || 'Failed to get bounties');
  }
  
  return result.data;
}

/**
 * Get a single bounty by ID
 */
export async function getBounty(bountyId: string): Promise<Bounty> {
  const result = await saltdigRequest<Bounty>(`/api/v1/market/listings/${bountyId}`);
  
  if (!result.success || !result.data) {
    throw new Error(result.error?.message || 'Failed to get bounty');
  }
  
  return result.data;
}

/**
 * Create a new bounty
 */
export async function createBounty(params: CreateBountyParams): Promise<Bounty> {
  const result = await saltdigRequest<Bounty>('/api/v1/market/listings', {
    method: 'POST',
    body: JSON.stringify(params),
  });
  
  if (!result.success || !result.data) {
    throw new Error(result.error?.message || 'Failed to create bounty');
  }
  
  return result.data;
}

/**
 * Claim a bounty (agent accepts the work)
 */
export async function claimBounty(bountyId: string, agentId: string): Promise<Bounty> {
  const result = await saltdigRequest<Bounty>(`/api/v1/market/listings/${bountyId}/order`, {
    method: 'POST',
    body: JSON.stringify({ agentId }),
  });
  
  if (!result.success || !result.data) {
    throw new Error(result.error?.message || 'Failed to claim bounty');
  }
  
  return result.data;
}

/**
 * Approve a bounty (release escrow to agent)
 */
export async function approveBounty(bountyId: string, approverId: string): Promise<Bounty> {
  const result = await saltdigRequest<Bounty>(`/api/v1/market/listings/${bountyId}/approve`, {
    method: 'POST',
    body: JSON.stringify({ approverId }),
  });
  
  if (!result.success || !result.data) {
    throw new Error(result.error?.message || 'Failed to approve bounty');
  }
  
  return result.data;
}

// ============================================================================
// MILESTONE API
// ============================================================================

/**
 * Start a milestone
 */
export async function startMilestone(bountyId: string, milestoneId: string, agentId: string): Promise<Milestone> {
  const result = await saltdigRequest<Milestone>(
    `/api/v1/market/listings/${bountyId}/milestones/${milestoneId}/start`,
    {
      method: 'POST',
      body: JSON.stringify({ agentId }),
    }
  );
  
  if (!result.success || !result.data) {
    throw new Error(result.error?.message || 'Failed to start milestone');
  }
  
  return result.data;
}

/**
 * Submit a milestone
 */
export async function submitMilestone(
  bountyId: string,
  milestoneId: string,
  agentId: string,
  evidence: Array<{ type: string; content: string; metadata?: object }>
): Promise<Milestone> {
  const result = await saltdigRequest<Milestone>(
    `/api/v1/market/listings/${bountyId}/milestones/${milestoneId}/submit`,
    {
      method: 'POST',
      body: JSON.stringify({ agentId, evidence }),
    }
  );
  
  if (!result.success || !result.data) {
    throw new Error(result.error?.message || 'Failed to submit milestone');
  }
  
  return result.data;
}

/**
 * Approve a milestone (partial escrow release)
 */
export async function approveMilestone(bountyId: string, milestoneId: string, approverId: string): Promise<Milestone> {
  const result = await saltdigRequest<Milestone>(
    `/api/v1/market/listings/${bountyId}/milestones/${milestoneId}/approve`,
    {
      method: 'POST',
      body: JSON.stringify({ approverId }),
    }
  );
  
  if (!result.success || !result.data) {
    throw new Error(result.error?.message || 'Failed to approve milestone');
  }
  
  return result.data;
}

/**
 * Reject a milestone
 */
export async function rejectMilestone(
  bountyId: string,
  milestoneId: string,
  approverId: string,
  reason: string
): Promise<Milestone> {
  const result = await saltdigRequest<Milestone>(
    `/api/v1/market/listings/${bountyId}/milestones/${milestoneId}/reject`,
    {
      method: 'POST',
      body: JSON.stringify({ approverId, reason }),
    }
  );
  
  if (!result.success || !result.data) {
    throw new Error(result.error?.message || 'Failed to reject milestone');
  }
  
  return result.data;
}

// ============================================================================
// SPEC LOOP API
// ============================================================================

/**
 * Deposit for spec review
 */
export async function depositForSpec(bountyId: string, agentId: string, amount: number): Promise<void> {
  const result = await saltdigRequest<void>(`/api/v1/market/listings/${bountyId}/spec/deposit`, {
    method: 'POST',
    body: JSON.stringify({ agentId, amount }),
  });
  
  if (!result.success) {
    throw new Error(result.error?.message || 'Failed to deposit for spec');
  }
}

/**
 * Freeze spec (lock specification, convert remaining deposit to budget credit)
 */
export async function freezeSpec(bountyId: string, agentId: string): Promise<Bounty> {
  const result = await saltdigRequest<Bounty>(`/api/v1/market/listings/${bountyId}/spec/freeze`, {
    method: 'POST',
    body: JSON.stringify({ agentId }),
  });
  
  if (!result.success || !result.data) {
    throw new Error(result.error?.message || 'Failed to freeze spec');
  }
  
  return result.data;
}

/**
 * Create change order (request spec changes after freeze)
 */
export async function createChangeOrder(
  bountyId: string,
  agentId: string,
  description: string,
  estimatedDelta: number
): Promise<{ changeOrderId: string }> {
  const result = await saltdigRequest<{ changeOrderId: string }>(
    `/api/v1/market/listings/${bountyId}/spec/change-order`,
    {
      method: 'POST',
      body: JSON.stringify({ agentId, description, estimatedDelta }),
    }
  );
  
  if (!result.success || !result.data) {
    throw new Error(result.error?.message || 'Failed to create change order');
  }
  
  return result.data;
}

/**
 * Approve change order
 */
export async function approveChangeOrder(
  bountyId: string,
  changeOrderId: string,
  approverId: string
): Promise<void> {
  const result = await saltdigRequest<void>(
    `/api/v1/market/listings/${bountyId}/spec/change-order/${changeOrderId}/approve`,
    {
      method: 'POST',
      body: JSON.stringify({ approverId }),
    }
  );
  
  if (!result.success) {
    throw new Error(result.error?.message || 'Failed to approve change order');
  }
}

// ============================================================================
// BETTING/TIPPING (for Arena/Stage integration)
// ============================================================================

/**
 * Place a bet (for Arena predictions)
 */
export async function placeBet(params: {
  agentId: string;
  predictionId: string;
  amount: number;
  currency: 'SALT' | 'USDC';
}): Promise<void> {
  // This would be implemented in saltdig to handle betting escrow
  // For now, this is a stub
  const result = await saltdigRequest<void>('/api/v1/betting/place', {
    method: 'POST',
    body: JSON.stringify(params),
  });
  
  if (!result.success) {
    throw new Error(result.error?.message || 'Failed to place bet');
  }
}

/**
 * Send a tip (for Stage performances)
 */
export async function sendTip(params: {
  fromAgentId: string;
  toAgentId: string;
  amount: number;
  currency: 'SALT' | 'USDC';
  performanceId: string;
}): Promise<void> {
  // This would be implemented in saltdig to handle tipping
  // For now, this is a stub
  const result = await saltdigRequest<void>('/api/v1/tipping/send', {
    method: 'POST',
    body: JSON.stringify(params),
  });
  
  if (!result.success) {
    throw new Error(result.error?.message || 'Failed to send tip');
  }
}
