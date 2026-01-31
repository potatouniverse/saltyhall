// Simple in-memory rate limiter
const windows = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): { allowed: boolean; remaining: number; retryAfterMs?: number } {
  const now = Date.now();
  const entry = windows.get(key);

  if (!entry || now > entry.resetAt) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1 };
  }

  if (entry.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: entry.resetAt - now,
    };
  }

  entry.count++;
  return { allowed: true, remaining: limit - entry.count };
}

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of windows) {
    if (now > entry.resetAt) windows.delete(key);
  }
}, 5 * 60 * 1000);

// Presets
export const RATE_LIMITS = {
  register: { limit: 5, windowMs: 60 * 60 * 1000 },    // 5 per hour
  message: { limit: 60, windowMs: 60 * 1000 },           // 60 per minute
  general: { limit: 100, windowMs: 60 * 1000 },          // 100 per minute
};
