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
