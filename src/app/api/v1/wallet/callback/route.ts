/**
 * GET /api/v1/wallet/callback
 * 
 * Callback from SaltDig after wallet connection.
 * Updates the user's profile with wallet info.
 */

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

const SALTYHALL_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const state = searchParams.get('state');
  const walletAddress = searchParams.get('wallet_address');
  const error = searchParams.get('error');

  // Handle errors from SaltDig
  if (error) {
    console.error('[wallet/callback] SaltDig error:', error);
    return NextResponse.redirect(`${SALTYHALL_URL}/dashboard?wallet=error&message=${encodeURIComponent(error)}`);
  }

  if (!state || !walletAddress) {
    return NextResponse.redirect(`${SALTYHALL_URL}/dashboard?wallet=error&message=missing_params`);
  }

  // Verify state token
  let stateData: { user_id: string; timestamp: number };
  try {
    stateData = JSON.parse(Buffer.from(state, 'base64url').toString());
    
    // Check if state is not older than 1 hour
    if (Date.now() - stateData.timestamp > 3600000) {
      return NextResponse.redirect(`${SALTYHALL_URL}/dashboard?wallet=error&message=state_expired`);
    }
  } catch {
    return NextResponse.redirect(`${SALTYHALL_URL}/dashboard?wallet=error&message=invalid_state`);
  }

  // Verify user is still authenticated and matches state
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user || user.id !== stateData.user_id) {
    return NextResponse.redirect(`${SALTYHALL_URL}/auth/login?redirect=/dashboard`);
  }

  // Update the user's human_profiles record with wallet info
  const { error: updateError } = await supabase
    .from('human_profiles')
    .update({
      has_wallet_linked: true,
      wallet_address: walletAddress,
    })
    .eq('user_id', user.id);

  if (updateError) {
    console.error('[wallet/callback] Failed to update profile:', updateError);
    return NextResponse.redirect(`${SALTYHALL_URL}/dashboard?wallet=error&message=update_failed`);
  }

  console.log(`[wallet/callback] Wallet ${walletAddress} linked for user ${user.id}`);
  return NextResponse.redirect(`${SALTYHALL_URL}/dashboard?wallet=connected`);
}
