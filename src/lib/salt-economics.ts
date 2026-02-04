/**
 * Salt burn rates and economic constants.
 * Burns are sink mechanisms that remove Salt from circulation,
 * preventing infinite inflation and maintaining value as a reputation signal.
 */

export const SALT_BURNS = {
  ROOM_CREATION: 200,        // already exists in rooms/route.ts
  ARENA_TOPIC_CREATION: 100, // creating a prediction topic
  ARENA_ENTRY_FEE: 5,        // small fee on each prediction (in addition to bet)
  MARKET_COMMISSION: 0.05,   // 5% of Salt transaction value burned
  PREMIUM_FEATURES: 50,      // future: premium room features etc
} as const;

/**
 * Platform fee configuration for USDC transactions.
 * Fee is deducted from escrow release and sent to platform wallet.
 */
export const PLATFORM_FEE = {
  /** Platform fee percentage (0.00 = 0%, 0.05 = 5%, etc). Defaults to 0% at launch. */
  PERCENT: parseFloat(process.env.PLATFORM_FEE_PERCENT || '0') / 100,
  /** Wallet address for collecting platform fees */
  WALLET: process.env.PLATFORM_FEE_WALLET || '',
  /** Minimum fee in USDC (below this, no fee is charged) */
  MIN_TRANSACTION: 1.0,
} as const;

/**
 * Calculate platform fee for a USDC amount.
 * Returns { grossAmount, feeAmount, netAmount }
 */
export function calculatePlatformFee(usdcAmount: number): {
  grossAmount: number;
  feeAmount: number;
  netAmount: number;
} {
  // If no fee configured or amount too small, no fee
  if (PLATFORM_FEE.PERCENT <= 0 || usdcAmount < PLATFORM_FEE.MIN_TRANSACTION) {
    return {
      grossAmount: usdcAmount,
      feeAmount: 0,
      netAmount: usdcAmount,
    };
  }

  const feeAmount = Math.floor(usdcAmount * PLATFORM_FEE.PERCENT * 100) / 100; // Round to 2 decimals
  const netAmount = usdcAmount - feeAmount;

  return {
    grossAmount: usdcAmount,
    feeAmount,
    netAmount,
  };
}

/**
 * Burn Salt from an agent's balance and record the transaction.
 * Uses transferNacl with to_agent_id=null (Salt leaves circulation).
 */
export async function burnSalt(
  db: any,
  agentId: string,
  amount: number,
  burnType: string,
  description: string
): Promise<{ success: boolean; error?: string }> {
  if (amount <= 0) return { success: true };

  const balance = await db.getNaclBalance(agentId);
  if (balance < amount) {
    return { success: false, error: `Insufficient Salt. Need ${amount}, have ${balance}` };
  }

  await db.transferNacl(agentId, null, amount, "burn", `🔥 ${description}`);
  return { success: true };
}
