/**
 * POST /api/v1/bounties/[id]/sandbox
 * Create a sandbox for a claimed bounty
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db-factory';
import { sandboxManager } from '@/lib/sandbox';
import { parseBountySpec } from '@/lib/bounty-graph';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: bountyId } = await params;

    // Get API key from header
    const apiKey = req.headers.get('X-API-Key') || req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'API key required' },
        { status: 401 }
      );
    }

    // Authenticate agent
    const agent = await db.getAgentByKey(apiKey);
    if (!agent) {
      return NextResponse.json(
        { success: false, error: 'Invalid API key' },
        { status: 401 }
      );
    }

    // Get bounty listing
    const listing = await db.getMarketListing(bountyId);
    if (!listing) {
      return NextResponse.json(
        { success: false, error: 'Bounty not found' },
        { status: 404 }
      );
    }

    // Verify agent has claimed this bounty
    const order = await db.getServiceOrder(bountyId);
    if (!order || order.seller_id !== agent.id) {
      return NextResponse.json(
        { success: false, error: 'Bounty not claimed by this agent' },
        { status: 403 }
      );
    }

    // Get bounty spec from listing metadata or database
    const bountyGraphYaml = await db.getBountyGraph(bountyId);
    if (!bountyGraphYaml) {
      return NextResponse.json(
        { success: false, error: 'Bounty spec not found' },
        { status: 404 }
      );
    }

    const bountySpec = parseBountySpec(bountyGraphYaml);

    // Create sandbox
    const sandbox = await sandboxManager.createSandbox(agent.id, bountyId, bountySpec);

    // Store sandbox in database
    await db.createSandbox({
      id: sandbox.id,
      bounty_id: bountyId,
      agent_id: agent.id,
      scope_json: JSON.stringify(sandbox.access_scope),
      status: 'active',
      evidence_json: null,
      created_at: sandbox.created_at,
    });

    return NextResponse.json({
      success: true,
      sandbox: {
        id: sandbox.id,
        bounty_id: bountyId,
        workspace_path: sandbox.workspace_path,
        access_scope: sandbox.access_scope,
        status: sandbox.status,
        created_at: sandbox.created_at,
      },
    });
  } catch (error: any) {
    console.error('Error creating sandbox:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create sandbox' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/v1/bounties/[id]/sandbox
 * Get existing sandbox for a bounty
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: bountyId } = await params;

    // Get API key from header
    const apiKey = req.headers.get('X-API-Key') || req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'API key required' },
        { status: 401 }
      );
    }

    // Authenticate agent
    const agent = await db.getAgentByKey(apiKey);
    if (!agent) {
      return NextResponse.json(
        { success: false, error: 'Invalid API key' },
        { status: 401 }
      );
    }

    // Get sandbox from database
    const sandbox = await db.getSandboxByBountyAndAgent(bountyId, agent.id);
    if (!sandbox) {
      return NextResponse.json(
        { success: false, error: 'Sandbox not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      sandbox: {
        id: sandbox.id,
        bounty_id: sandbox.bounty_id,
        status: sandbox.status,
        access_scope: JSON.parse(sandbox.scope_json),
        created_at: sandbox.created_at,
        destroyed_at: sandbox.destroyed_at,
      },
    });
  } catch (error: any) {
    console.error('Error fetching sandbox:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch sandbox' },
      { status: 500 }
    );
  }
}
