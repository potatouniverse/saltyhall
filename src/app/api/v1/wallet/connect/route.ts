/**
 * GET /api/v1/wallet/connect
 * 
 * Initiates wallet connection flow via SaltDig.
 * Redirects the user to SaltDig's wallet connect page.
 * After connecting, SaltDig redirects back to /api/v1/wallet/callback
 */

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

const SALTDIG_API_URL = process.env.SALTDIG_API_URL || 'http://localhost:3001';
const SALTYHALL_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

export async function GET(req: NextRequest) {
  // Check if user is authenticated
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error || !user) {
    // Redirect to login first
    const returnTo = `${SALTYHALL_URL}/api/v1/wallet/connect`;
    return NextResponse.redirect(
      `${SALTYHALL_URL}/auth/login?redirect=${encodeURIComponent(returnTo)}`
    );
  }

  // Generate a state token for CSRF protection
  const state = Buffer.from(JSON.stringify({
    user_id: user.id,
    timestamp: Date.now(),
  })).toString('base64url');

  // Build SaltDig connect URL
  // Note: This assumes SaltDig has an OAuth-like flow
  const connectUrl = new URL(`${SALTDIG_API_URL}/connect`);
  connectUrl.searchParams.set('client_id', 'saltyhall');
  connectUrl.searchParams.set('redirect_uri', `${SALTYHALL_URL}/api/v1/wallet/callback`);
  connectUrl.searchParams.set('state', state);
  connectUrl.searchParams.set('scope', 'wallet:read wallet:write');
  
  // If SaltDig isn't available yet, show a coming soon page
  if (!process.env.SALTDIG_API_URL) {
    return NextResponse.redirect(`${SALTYHALL_URL}/dashboard?wallet=coming-soon`);
  }

  return NextResponse.redirect(connectUrl.toString());
}
