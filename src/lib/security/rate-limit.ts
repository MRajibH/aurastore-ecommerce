import { NextResponse } from 'next/server';

/**
 * In-memory fixed-window rate limiter. Suitable for a single instance; for a
 * horizontally-scaled SaaS, swap the Map for Redis (same interface). Keys are
 * namespaced per rule + identifier (usually IP, sometimes IP+email).
 */
interface Bucket {
  count: number;
  resetAt: number;
}

const store = new Map<string, Bucket>();

// Opportunistic cleanup so the map can't grow unbounded.
function sweep(now: number) {
  if (store.size < 5000) return;
  for (const [key, bucket] of store) {
    if (now > bucket.resetAt) store.delete(key);
  }
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfter: number; // seconds
}

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  sweep(now);
  const bucket = store.get(key);
  if (!bucket || now > bucket.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, retryAfter: 0 };
  }
  bucket.count += 1;
  if (bucket.count > limit) {
    return { ok: false, remaining: 0, retryAfter: Math.ceil((bucket.resetAt - now) / 1000) };
  }
  return { ok: true, remaining: limit - bucket.count, retryAfter: 0 };
}

/** Reset a key (e.g. clear failed-login counter after a success). */
export function resetRateLimit(key: string): void {
  store.delete(key);
}

/** Best-effort client IP from proxy headers. */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return request.headers.get('x-real-ip') || 'unknown';
}

/**
 * Enforce a rate limit for a request. Returns a 429 NextResponse when exceeded,
 * or null when the request may proceed.
 */
export function enforceRateLimit(
  request: Request,
  name: string,
  limit: number,
  windowMs: number,
  extraKey = '',
): NextResponse | null {
  const key = `${name}:${getClientIp(request)}${extraKey ? `:${extraKey}` : ''}`;
  const result = rateLimit(key, limit, windowMs);
  if (result.ok) return null;
  return NextResponse.json(
    { error: 'Too many requests. Please slow down and try again shortly.' },
    { status: 429, headers: { 'Retry-After': String(result.retryAfter) } },
  );
}
