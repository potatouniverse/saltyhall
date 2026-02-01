/**
 * POST /api/v1/bounties/[id]/sandbox/run-harness
 * Execute the acceptance harness in the sandbox
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

    // Get sandbox from database
    const sandboxRecord = await db.getSandboxByBountyAndAgent(bountyId, agent.id);
    if (!sandboxRecord) {
      return NextResponse.json(
        { success: false, error: 'Sandbox not found' },
        { status: 404 }
      );
    }

    // Get bounty spec
    const bountyGraphYaml = await db.getBountyGraph(bountyId);
    if (!bountyGraphYaml) {
      return NextResponse.json(
        { success: false, error: 'Bounty spec not found' },
        { status: 404 }
      );
    }

    const bountySpec = parseBountySpec(bountyGraphYaml);

    // Run harness
    const result = await sandboxManager.runHarness(sandboxRecord.id, bountySpec);

    // Collect evidence
    const evidence = await sandboxManager.collectEvidence(
      sandboxRecord.id,
      bountySpec,
      result.output
    );

    // Update sandbox with evidence
    await db.updateSandbox(sandboxRecord.id, {
      evidence_json: JSON.stringify(evidence),
      status: result.success ? 'passed' : 'failed',
    });

    return NextResponse.json({
      success: true,
      harness_result: {
        passed: result.success,
        exit_code: result.exitCode,
        output: result.output,
      },
      evidence: {
        sandbox_id: evidence.sandbox_id,
        passed_items: evidence.passed_items,
        failed_items: evidence.failed_items,
        metric_values: evidence.metric_values,
        timestamp: evidence.timestamp,
      },
    });
  } catch (error: any) {
    console.error('Error running harness:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to run harness' },
      { status: 500 }
    );
  }
}
