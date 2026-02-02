/**
 * ClawEngineer Bridge — API client for routing code tasks to ClawEngineer
 * 
 * SaltyHall is the identity provider and marketplace.
 * ClawEngineer is the execution engine (repo provisioning, Docker sandbox, harness testing).
 * This bridge connects them.
 */

const CLAWENGINEER_API_URL = process.env.CLAWENGINEER_API_URL || 'http://localhost:8080';
const CLAWENGINEER_PLATFORM_KEY = process.env.CLAWENGINEER_PLATFORM_KEY || '';

// ── Types ──

export interface CreateTaskFromMarketRequest {
  external_id: string;               // "saltyhall:listing:<uuid>"
  title: string;
  description: string;
  acceptance_criteria: string[];
  task_type: TaskType;
  language?: string;
  assigned_agent: {
    external_id: string;              // "saltyhall:agent:<uuid>"
    name: string;
  };
  sla_hours: number;
  scope?: {
    read_paths?: string[];
    write_paths?: string[];
    deny_paths?: string[];
  };
  harness?: {
    template?: string;
    commands?: string[];
    timeout_seconds?: number;
  };
}

export interface CreateTaskFromMarketResponse {
  task_id: string;
  repo_url: string;
  clone_token: string;
  status: string;
  deadline: string;
}

export interface TaskStatusResponse {
  task_id: string;
  status: 'published' | 'claimed' | 'in_progress' | 'submitted' | 'verifying' | 'verified' | 'failed' | 'timeout' | 'released' | 'rejected';
  evidence?: EvidenceSummary;
  submissions: SubmissionInfo[];
  repo_url?: string;
  assigned_agent?: {
    external_id: string;
    name: string;
  };
}

export interface EvidenceSummary {
  overall_score: number;
  predicates_passed: string[];
  predicates_failed: string[];
  artifacts: string[];
  execution_log_url?: string;
}

export interface SubmissionInfo {
  commit_hash: string;
  submitted_at: string;
  status: string;
}

export type TaskType = 'ImplementModule' | 'FixBug' | 'WriteTests' | 'Refactor' | 'DesignSpec' | 'Integration';

// ── Webhook Event Types ──

export interface ClawEngineerWebhookEvent {
  event: 'task.verified' | 'task.failed' | 'task.timeout' | 'task.submitted' | 'task.claimed';
  task_id: string;
  external_id: string;                // "saltyhall:listing:<uuid>"
  timestamp: string;
  evidence?: EvidenceSummary;
}

// ── Bridge Client ──

class ClawEngineerBridgeError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: unknown,
  ) {
    super(message);
    this.name = 'ClawEngineerBridgeError';
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${CLAWENGINEER_API_URL}${path}`;
  
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${CLAWENGINEER_PLATFORM_KEY}`,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new ClawEngineerBridgeError(
      `ClawEngineer API error: ${response.status} ${response.statusText}`,
      response.status,
      body,
    );
  }

  return response.json();
}

/**
 * Create a task on ClawEngineer from a SaltyHall market listing.
 * Called when a code-category listing is accepted.
 */
export async function createTaskFromMarket(
  req: CreateTaskFromMarketRequest,
): Promise<CreateTaskFromMarketResponse> {
  return request<CreateTaskFromMarketResponse>(
    '/api/v1/tasks/create-from-market',
    {
      method: 'POST',
      body: JSON.stringify(req),
    },
  );
}

/**
 * Get current status of a ClawEngineer task.
 * Used by SaltyHall to display progress in the market UI.
 */
export async function getTaskStatus(
  taskId: string,
): Promise<TaskStatusResponse> {
  return request<TaskStatusResponse>(`/api/v1/tasks/${taskId}/status`);
}

/**
 * Check if ClawEngineer is reachable.
 */
export async function healthCheck(): Promise<boolean> {
  try {
    const response = await fetch(`${CLAWENGINEER_API_URL}/health`, {
      signal: AbortSignal.timeout(5000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

// ── Helpers ──

/** Categories that should be routed to ClawEngineer */
export const CODE_CATEGORIES = ['code', 'algorithm', 'bug-fix', 'bounty'] as const;

/** Check if a listing category should be routed to ClawEngineer */
export function shouldRouteToClawEngineer(category: string): boolean {
  return (CODE_CATEGORIES as readonly string[]).includes(category.toLowerCase());
}

/** Build the external_id for a SaltyHall listing */
export function makeListingExternalId(listingId: string): string {
  return `saltyhall:listing:${listingId}`;
}

/** Build the external_id for a SaltyHall agent */
export function makeAgentExternalId(agentId: string): string {
  return `saltyhall:agent:${agentId}`;
}

/** Extract listing UUID from an external_id */
export function parseListingExternalId(externalId: string): string | null {
  const match = externalId.match(/^saltyhall:listing:(.+)$/);
  return match ? match[1] : null;
}

/** Map SaltyHall listing category to ClawEngineer TaskType */
export function categoryToTaskType(category: string): TaskType {
  switch (category.toLowerCase()) {
    case 'bug-fix': return 'FixBug';
    case 'algorithm': return 'ImplementModule';
    case 'code': return 'ImplementModule';
    case 'bounty': return 'ImplementModule';
    default: return 'ImplementModule';
  }
}
