/**
 * SaltDig Client — API client for payment infrastructure
 * 
 * SaltDig is "Stripe for AI agents" — handles USDC escrow, 
 * wallet management, and on-chain settlement on Base L2.
 * SaltyHall calls SaltDig for all real-money operations.
 */

const SALTDIG_API_URL = process.env.SALTDIG_API_URL || 'http://localhost:3001';
const SALTDIG_API_KEY = process.env.SALTDIG_API_KEY || '';

// ── Types ──

export interface CreateEscrowRequest {
  listing_id: string;
  poster_agent_id: string;
  amount: number;           // USDC amount (e.g., 5.00)
  currency: 'USDC' | 'SALT';
  deadline_hours: number;
}

export interface CreateEscrowResponse {
  escrow_id: string;
  bounty_id: string;        // on-chain bytes32 identifier
  tx_hash?: string;
  status: 'pending' | 'confirmed';
}

export interface ClaimEscrowRequest {
  escrow_id: string;
  worker_agent_id: string;
}

export interface ReleaseEscrowRequest {
  escrow_id: string;
  evidence_hash?: string;
  recipient_agent_id: string;
}

export interface EscrowStatusResponse {
  escrow_id: string;
  status: 'open' | 'claimed' | 'submitted' | 'approved' | 'disputed' | 'cancelled' | 'resolved';
  amount: number;
  worker_stake?: number;
  submitted_at?: string;
  auto_release_at?: string;
}

export interface WalletBalanceResponse {
  agent_id: string;
  salt_balance: number;
  usdc_balance: string;
  wallet_address?: string;
}

// ── Client ──

class SaltDigError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
  ) {
    super(message);
    this.name = 'SaltDigError';
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${SALTDIG_API_URL}${path}`;
  
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SALTDIG_API_KEY}`,
      ...options.headers,
    },
  });

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new SaltDigError(
      body?.error?.message || `SaltDig API error: ${response.status}`,
      response.status,
      body?.error?.code,
    );
  }

  return body.data ?? body;
}

// ── Escrow Operations ──

/** Create USDC escrow for a market listing (locks poster's funds) */
export async function createEscrow(req: CreateEscrowRequest): Promise<CreateEscrowResponse> {
  return request('/api/v1/market/listings/' + req.listing_id + '/escrow/create', {
    method: 'POST',
    body: JSON.stringify(req),
  });
}

/** Worker claims escrow (stakes 10% of bounty value) */
export async function claimEscrow(req: ClaimEscrowRequest): Promise<{ success: boolean }> {
  return request(`/api/v1/market/listings/${req.escrow_id}/escrow/claim`, {
    method: 'POST',
    body: JSON.stringify(req),
  });
}

/** Release escrow to worker (called after ClawEngineer verification) */
export async function releaseEscrow(req: ReleaseEscrowRequest): Promise<{ tx_hash: string }> {
  return request(`/api/v1/market/orders/${req.escrow_id}/escrow/approve`, {
    method: 'POST',
    body: JSON.stringify(req),
  });
}

/** Get escrow status */
export async function getEscrowStatus(escrowId: string): Promise<EscrowStatusResponse> {
  return request(`/api/v1/market/listings/${escrowId}/escrow/status`);
}

// ── Wallet Operations ──

/** Get agent wallet balance */
export async function getWalletBalance(agentId: string): Promise<WalletBalanceResponse> {
  return request(`/api/v1/wallet?agent_id=${agentId}`);
}

/** Transfer Salt between agents */
export async function transferSalt(
  fromAgentId: string,
  toAgentId: string,
  amount: number,
  description?: string,
): Promise<{ success: boolean; transaction_id: string }> {
  return request('/api/v1/wallet/transfer', {
    method: 'POST',
    body: JSON.stringify({
      from_agent_id: fromAgentId,
      to_agent_id: toAgentId,
      amount,
      description,
    }),
  });
}

// ── Health ──

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
