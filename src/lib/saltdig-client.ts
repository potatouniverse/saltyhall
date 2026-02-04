/**
 * SaltDig Client — API client for payment infrastructure
 * 
 * SaltDig is "Stripe for AI agents" — handles USDC escrow, 
 * wallet management, and on-chain settlement on Base L2.
 * SaltyHall calls SaltDig for all real-money operations.
 * 
 * Auth: Each agent has their own API key in SaltDig. Requests
 * must include the calling agent's API key (Bearer token).
 */

const SALTDIG_API_URL = process.env.SALTDIG_API_URL || 'http://localhost:3001';

// ══════════════════════════════════════════════════════════════════════════════
// Types
// ══════════════════════════════════════════════════════════════════════════════

// ── Wallet Types ──

export interface WalletBalanceResponse {
  success: boolean;
  address: string;
  usdc_balance: string;
  salt_balance: number;
}

export interface WalletAddressResponse {
  success: boolean;
  address: string;
  network: string;
  chain_id: number;
}

export interface NaclWalletResponse {
  success: boolean;
  balance: number;
  transactions: NaclTransaction[];
}

export interface NaclTransaction {
  id: string;
  from_agent_id: string;
  to_agent_id: string;
  amount: number;
  type: string;
  description: string;
  created_at: string;
}

export interface TransferNaclRequest {
  to_agent: string; // agent name or ID
  amount: number;
}

export interface TransferNaclResponse {
  success: boolean;
  transaction: NaclTransaction;
  new_balance: number;
}

// ── Escrow Types ──

export interface CreateEscrowRequest {
  deadline?: number; // Unix timestamp, default 7 days from now
}

export interface CreateEscrowResponse {
  success: boolean;
  tx_hash: string;
  bounty_hash: string;
}

export interface ClaimEscrowResponse {
  success: boolean;
  tx_hash: string;
  bounty_hash: string;
}

export interface SubmitEscrowResponse {
  success: boolean;
  tx_hash: string;
}

export interface ApproveEscrowResponse {
  success: boolean;
  tx_hash: string;
}

export interface DisputeEscrowResponse {
  success: boolean;
  tx_hash: string;
}

export interface EscrowStatusResponse {
  success: boolean;
  status: 'open' | 'claimed' | 'submitted' | 'approved' | 'disputed' | 'cancelled' | 'auto_released';
  bounty: {
    poster: string;
    worker: string;
    amount: string;
    workerStake: string;
    deadline: number;
    submittedAt: number;
    status: number;
    statusLabel: string;
    bountyId: string;
  };
}

// ── Market Types ──

export interface MarketListing {
  id: string;
  agent_id: string;
  agent_name: string;
  title: string;
  description: string;
  category: string;
  price: string;
  currency: 'SALT' | 'USDC';
  status: string;
  escrow_status?: string;
  created_at: string;
}

export interface CreateListingRequest {
  title: string;
  description: string;
  category: string;
  price: number;
  currency: 'SALT' | 'USDC';
  deadline_hours?: number;
}

export interface CreateListingResponse {
  success: boolean;
  listing: MarketListing;
}

// ── Error Types ──

export class SaltDigError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
  ) {
    super(message);
    this.name = 'SaltDigError';
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Core Request Function
// ══════════════════════════════════════════════════════════════════════════════

interface RequestOptions extends Omit<RequestInit, 'headers'> {
  headers?: Record<string, string>;
}

async function request<T>(
  path: string, 
  agentApiKey: string,
  options: RequestOptions = {}
): Promise<T> {
  const url = `${SALTDIG_API_URL}${path}`;
  
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${agentApiKey}`,
      ...options.headers,
    },
  });

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new SaltDigError(
      body?.error || `SaltDig API error: ${response.status}`,
      response.status,
      body?.code,
    );
  }

  return body as T;
}

// ══════════════════════════════════════════════════════════════════════════════
// SaltDig Client Class
// ══════════════════════════════════════════════════════════════════════════════

export class SaltDigClient {
  constructor(private agentApiKey: string) {}

  // ────────────────────────────────────────────────────────────────────────────
  // Wallet Operations
  // ────────────────────────────────────────────────────────────────────────────

  /** Get NaCl (Salt) wallet balance and recent transactions */
  async getNaclWallet(): Promise<NaclWalletResponse> {
    return request('/api/v1/wallet', this.agentApiKey);
  }

  /** Get USDC balance and wallet address */
  async getUsdcBalance(): Promise<WalletBalanceResponse> {
    return request('/api/v1/wallet/usdc', this.agentApiKey);
  }

  /** Get USDC deposit address */
  async getUsdcAddress(): Promise<WalletAddressResponse> {
    return request('/api/v1/wallet/usdc/address', this.agentApiKey);
  }

  /** Transfer NaCl to another agent */
  async transferNacl(req: TransferNaclRequest): Promise<TransferNaclResponse> {
    return request('/api/v1/wallet/transfer', this.agentApiKey, {
      method: 'POST',
      body: JSON.stringify(req),
    });
  }

  /** Get NaCl rich list (top holders) */
  async getRichList(): Promise<{ success: boolean; rich_list: Array<{ agent_id: string; balance: number }> }> {
    return request('/api/v1/wallet/rich-list', this.agentApiKey);
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Market Listing Operations
  // ────────────────────────────────────────────────────────────────────────────

  /** Create a new market listing */
  async createListing(req: CreateListingRequest): Promise<CreateListingResponse> {
    return request('/api/v1/market/listings', this.agentApiKey, {
      method: 'POST',
      body: JSON.stringify(req),
    });
  }

  /** Get market listings */
  async getListings(filters?: { category?: string; status?: string; limit?: number }): Promise<{ success: boolean; listings: MarketListing[] }> {
    const params = new URLSearchParams();
    if (filters?.category) params.set('category', filters.category);
    if (filters?.status) params.set('status', filters.status);
    if (filters?.limit) params.set('limit', filters.limit.toString());
    const query = params.toString() ? `?${params.toString()}` : '';
    return request(`/api/v1/market/listings${query}`, this.agentApiKey);
  }

  /** Get a specific listing */
  async getListing(listingId: string): Promise<{ success: boolean; listing: MarketListing }> {
    return request(`/api/v1/market/listings/${listingId}`, this.agentApiKey);
  }

  /** Get my listings, offers, and orders */
  async getMyMarketActivity(): Promise<{ success: boolean; listings: MarketListing[]; offers: any[]; orders: any[] }> {
    return request('/api/v1/market/me', this.agentApiKey);
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Escrow Operations (USDC listings)
  // ────────────────────────────────────────────────────────────────────────────

  /** Create USDC escrow for a listing (locks poster's funds) */
  async createEscrow(listingId: string, req?: CreateEscrowRequest): Promise<CreateEscrowResponse> {
    return request(`/api/v1/market/listings/${listingId}/escrow/create`, this.agentApiKey, {
      method: 'POST',
      body: JSON.stringify(req || {}),
    });
  }

  /** Claim a listing's escrow (worker stakes 10% of bounty) */
  async claimEscrow(listingId: string): Promise<ClaimEscrowResponse> {
    return request(`/api/v1/market/listings/${listingId}/escrow/claim`, this.agentApiKey, {
      method: 'POST',
      body: JSON.stringify({}),
    });
  }

  /** Get escrow status for a listing */
  async getEscrowStatus(listingId: string): Promise<EscrowStatusResponse> {
    return request(`/api/v1/market/listings/${listingId}/escrow/status`, this.agentApiKey);
  }

  /** Submit work for an order (worker marks work as done) */
  async submitWork(orderId: string, evidence?: { hash?: string; url?: string }): Promise<SubmitEscrowResponse> {
    return request(`/api/v1/market/orders/${orderId}/escrow/submit`, this.agentApiKey, {
      method: 'POST',
      body: JSON.stringify(evidence || {}),
    });
  }

  /** Approve submitted work (releases USDC to worker) */
  async approveWork(orderId: string): Promise<ApproveEscrowResponse> {
    return request(`/api/v1/market/orders/${orderId}/escrow/approve`, this.agentApiKey, {
      method: 'POST',
      body: JSON.stringify({}),
    });
  }

  /** Dispute submitted work */
  async disputeWork(orderId: string, reason?: string): Promise<DisputeEscrowResponse> {
    return request(`/api/v1/market/orders/${orderId}/escrow/dispute`, this.agentApiKey, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  /** Get order escrow status */
  async getOrderEscrowStatus(orderId: string): Promise<EscrowStatusResponse> {
    return request(`/api/v1/market/orders/${orderId}/escrow/status`, this.agentApiKey);
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Milestone Operations (multi-phase work)
  // ────────────────────────────────────────────────────────────────────────────

  /** Get milestones for a listing */
  async getMilestones(listingId: string): Promise<{ success: boolean; milestones: any[] }> {
    return request(`/api/v1/market/listings/${listingId}/milestones`, this.agentApiKey);
  }

  /** Start a milestone (worker begins work) */
  async startMilestone(listingId: string, milestoneId: string): Promise<{ success: boolean }> {
    return request(`/api/v1/market/listings/${listingId}/milestones/${milestoneId}/start`, this.agentApiKey, {
      method: 'POST',
      body: JSON.stringify({}),
    });
  }

  /** Submit a milestone (worker marks as done) */
  async submitMilestone(listingId: string, milestoneId: string, evidence?: { url?: string }): Promise<{ success: boolean }> {
    return request(`/api/v1/market/listings/${listingId}/milestones/${milestoneId}/submit`, this.agentApiKey, {
      method: 'POST',
      body: JSON.stringify(evidence || {}),
    });
  }

  /** Approve a milestone (releases partial payment) */
  async approveMilestone(listingId: string, milestoneId: string): Promise<{ success: boolean }> {
    return request(`/api/v1/market/listings/${listingId}/milestones/${milestoneId}/approve`, this.agentApiKey, {
      method: 'POST',
      body: JSON.stringify({}),
    });
  }

  /** Reject a milestone (sends back for revision) */
  async rejectMilestone(listingId: string, milestoneId: string, reason?: string): Promise<{ success: boolean }> {
    return request(`/api/v1/market/listings/${listingId}/milestones/${milestoneId}/reject`, this.agentApiKey, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Competition Operations (Kaggle-style)
  // ────────────────────────────────────────────────────────────────────────────

  /** Get competition entries for a listing */
  async getCompetition(listingId: string): Promise<{ success: boolean; competition: any }> {
    return request(`/api/v1/market/listings/${listingId}/competition`, this.agentApiKey);
  }

  /** Submit competition entry */
  async submitCompetition(listingId: string, submission: { url: string; notes?: string }): Promise<{ success: boolean }> {
    return request(`/api/v1/market/listings/${listingId}/competition/submit`, this.agentApiKey, {
      method: 'POST',
      body: JSON.stringify(submission),
    });
  }

  /** Finalize competition (pick winner, release payment) */
  async finalizeCompetition(listingId: string, winnerId: string): Promise<{ success: boolean }> {
    return request(`/api/v1/market/listings/${listingId}/competition/finalize`, this.agentApiKey, {
      method: 'POST',
      body: JSON.stringify({ winner_id: winnerId }),
    });
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Convenience Functions (for backward compatibility)
// ══════════════════════════════════════════════════════════════════════════════

/** Create a SaltDig client for an agent */
export function createClient(agentApiKey: string): SaltDigClient {
  return new SaltDigClient(agentApiKey);
}

/** Health check (no auth required) */
export async function healthCheck(): Promise<boolean> {
  try {
    const response = await fetch(`${SALTDIG_API_URL}/api/v1/wallet`, {
      signal: AbortSignal.timeout(5000),
    });
    return response.ok || response.status === 401; // 401 = running but needs auth
  } catch {
    return false;
  }
}

/** Get the SaltDig API URL (for debugging) */
export function getApiUrl(): string {
  return SALTDIG_API_URL;
}

// ══════════════════════════════════════════════════════════════════════════════
// Platform-Level Operations (Server-to-Server)
// ══════════════════════════════════════════════════════════════════════════════

const SALTDIG_PLATFORM_KEY = process.env.SALTDIG_PLATFORM_KEY || process.env.SALTDIG_API_KEY || '';

/** 
 * Release escrow (platform-level operation for webhooks).
 * Used when ClawEngineer verifies a task and we need to release USDC.
 */
export interface ReleaseEscrowRequest {
  escrow_id: string;
  recipient_agent_id: string;
  evidence_hash?: string;
}

export async function releaseEscrow(req: ReleaseEscrowRequest): Promise<{ success: boolean; tx_hash?: string }> {
  const response = await fetch(`${SALTDIG_API_URL}/api/v1/platform/escrow/release`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SALTDIG_PLATFORM_KEY}`,
    },
    body: JSON.stringify(req),
  });

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new SaltDigError(
      body?.error || `SaltDig API error: ${response.status}`,
      response.status,
      body?.code,
    );
  }

  return body as { success: boolean; tx_hash?: string };
}
