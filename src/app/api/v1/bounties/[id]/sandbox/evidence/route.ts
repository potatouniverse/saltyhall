/**
 * GET /api/v1/bounties/[id]/sandbox/evidence
 * Get the evidence report from the sandbox
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db-factory';
import { parseBountySpec } from '@/lib/bounty-graph';
import { validateEvidence } from '@/lib/evidence';

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

    if (!sandbox.evidence_json) {
      return NextResponse.json(
        { success: false, error: 'No evidence available - run harness first' },
        { status: 404 }
      );
    }

    const evidence = JSON.parse(sandbox.evidence_json);

    // Get bounty spec for validation
    const bountyGraphYaml = await db.getBountyGraph(bountyId);
    if (!bountyGraphYaml) {
      return NextResponse.json(
        { success: false, error: 'Bounty spec not found' },
        { status: 404 }
      );
    }

    const bountySpec = parseBountySpec(bountyGraphYaml);

    // Validate evidence against acceptance criteria
    const validation = validateEvidence(evidence, bountySpec);

    return NextResponse.json({
      success: true,
      evidence,
      validation,
    });
  } catch (error: any) {
    console.error('Error fetching evidence:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch evidence' },
      { status: 500 }
    );
  }
}
