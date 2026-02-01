/**
 * GET /api/v1/bounties/[id]/sandbox/files
 * List accessible files in the sandbox
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db-factory';
import { sandboxManager } from '@/lib/sandbox';

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

    // List files in sandbox
    const files = await sandboxManager.getSandboxFiles(sandbox.id);

    return NextResponse.json({
      success: true,
      files,
      access_scope: JSON.parse(sandbox.scope_json),
    });
  } catch (error: any) {
    console.error('Error listing sandbox files:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to list files' },
      { status: 500 }
    );
  }
}
