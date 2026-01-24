/**
 * Simple in-memory rate limiter for authentication endpoints.
 * Protects against brute-force attacks.
 *
 * Note: This is a single-instance implementation. For multi-instance deployments,
 * consider using Redis or a similar distributed cache.
 */

type RateLimitEntry = {
  count: number;
  firstAttempt: number;
  blockedUntil?: number;
};

// Configuration
const MAX_ATTEMPTS = 5; // Maximum failed attempts before blocking
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes window
const BLOCK_DURATION_MS = 15 * 60 * 1000; // Block for 15 minutes after exceeding limit

// In-memory store (cleared on server restart)
const ipLimitStore = new Map<string, RateLimitEntry>();
const emailLimitStore = new Map<string, RateLimitEntry>();

// Clean up old entries periodically (every 5 minutes)
const CLEANUP_INTERVAL = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;

  lastCleanup = now;
  const cutoff = now - WINDOW_MS;

  for (const [key, entry] of ipLimitStore.entries()) {
    if (entry.firstAttempt < cutoff && (!entry.blockedUntil || entry.blockedUntil < now)) {
      ipLimitStore.delete(key);
    }
  }

  for (const [key, entry] of emailLimitStore.entries()) {
    if (entry.firstAttempt < cutoff && (!entry.blockedUntil || entry.blockedUntil < now)) {
      emailLimitStore.delete(key);
    }
  }
}

function getClientIp(request: Request): string {
  // Check various headers for the real client IP behind proxies
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const firstIp = forwardedFor.split(",")[0]?.trim();
    if (firstIp) return firstIp;
  }

  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();

  // Fallback to unknown (will still provide some protection via email limiting)
  return "unknown";
}

function checkLimit(store: Map<string, RateLimitEntry>, key: string): {
  allowed: boolean;
  retryAfter?: number;
  remaining: number;
} {
  cleanup();
  const now = Date.now();

  const entry = store.get(key);

  if (!entry) {
    return { allowed: true, remaining: MAX_ATTEMPTS - 1 };
  }

  // Check if currently blocked
  if (entry.blockedUntil && entry.blockedUntil > now) {
    const retryAfter = Math.ceil((entry.blockedUntil - now) / 1000);
    return { allowed: false, retryAfter, remaining: 0 };
  }

  // Check if window has expired (reset)
  if (now - entry.firstAttempt > WINDOW_MS) {
    store.delete(key);
    return { allowed: true, remaining: MAX_ATTEMPTS - 1 };
  }

  // Check if within limits
  const remaining = MAX_ATTEMPTS - entry.count;
  return { allowed: remaining > 0, remaining: Math.max(0, remaining) };
}

function recordAttempt(store: Map<string, RateLimitEntry>, key: string, success: boolean): void {
  if (success) {
    // Reset on successful authentication
    store.delete(key);
    return;
  }

  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now - entry.firstAttempt > WINDOW_MS) {
    // First attempt or window expired
    store.set(key, { count: 1, firstAttempt: now });
    return;
  }

  // Increment count
  const newCount = entry.count + 1;

  if (newCount >= MAX_ATTEMPTS) {
    // Block the key
    store.set(key, {
      count: newCount,
      firstAttempt: entry.firstAttempt,
      blockedUntil: now + BLOCK_DURATION_MS
    });
  } else {
    store.set(key, { count: newCount, firstAttempt: entry.firstAttempt });
  }
}

export type RateLimitResult = {
  allowed: boolean;
  retryAfter?: number;
  remaining: number;
  limitedBy?: "ip" | "email";
};

/**
 * Check if a login attempt is allowed.
 * Returns rate limit status for both IP and email.
 */
export function checkAuthRateLimit(request: Request, email?: string): RateLimitResult {
  const ip = getClientIp(request);
  const ipResult = checkLimit(ipLimitStore, ip);

  if (!ipResult.allowed) {
    return { ...ipResult, limitedBy: "ip" };
  }

  if (email) {
    const normalizedEmail = email.toLowerCase().trim();
    const emailResult = checkLimit(emailLimitStore, normalizedEmail);
    if (!emailResult.allowed) {
      return { ...emailResult, limitedBy: "email" };
    }
    // Return the stricter limit
    return {
      allowed: true,
      remaining: Math.min(ipResult.remaining, emailResult.remaining)
    };
  }

  return ipResult;
}

/**
 * Record an authentication attempt (success or failure).
 * Call this after the authentication result is known.
 */
export function recordAuthAttempt(
  request: Request,
  email: string,
  success: boolean
): void {
  const ip = getClientIp(request);
  const normalizedEmail = email.toLowerCase().trim();

  recordAttempt(ipLimitStore, ip, success);
  recordAttempt(emailLimitStore, normalizedEmail, success);
}

/**
 * Get rate limit info for headers.
 */
export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  const headers: Record<string, string> = {
    "X-RateLimit-Limit": String(MAX_ATTEMPTS),
    "X-RateLimit-Remaining": String(result.remaining)
  };

  if (result.retryAfter) {
    headers["Retry-After"] = String(result.retryAfter);
    headers["X-RateLimit-Reset"] = String(Math.ceil(Date.now() / 1000) + result.retryAfter);
  }

  return headers;
}
