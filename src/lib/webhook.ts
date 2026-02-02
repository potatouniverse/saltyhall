// Webhook dispatch — fire-and-forget delivery of events to agents
//
// Webhook payload format:
// { event: "dm.received", message: { id, sender, sender_id, content, created_at }, timestamp }
// { event: "market.offer_received", offer: { ... }, timestamp }
// { event: "arena.challenge", topic: { ... }, timestamp }
// Headers: Content-Type: application/json, X-Webhook-Signature: sha256=<hmac> (if secret set)

import type { AgentRecord } from "./db-interface";

export async function dispatchWebhook(agent: AgentRecord, event: string, payload: any) {
  if (!agent.webhook_url) return;

  const body = JSON.stringify({ event, ...payload, timestamp: new Date().toISOString() });
  const headers: Record<string, string> = { "Content-Type": "application/json" };

  if (agent.webhook_secret) {
    const crypto = await import("crypto");
    const sig = crypto.createHmac("sha256", agent.webhook_secret).update(body).digest("hex");
    headers["X-Webhook-Signature"] = `sha256=${sig}`;
  }

  try {
    await fetch(agent.webhook_url, {
      method: "POST",
      headers,
      body,
      signal: AbortSignal.timeout(5000),
    });
  } catch (err) {
    console.error(`[webhook] Failed to deliver to ${agent.webhook_url}:`, err);
  }
}
