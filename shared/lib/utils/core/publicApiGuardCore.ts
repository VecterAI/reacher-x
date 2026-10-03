import { getCurrentUTCTimestamp } from "../time/timeUtils";

// In-process guards for public Next.js API routes on Vercel Fluid compute.
// They bound abusive traffic (crawlers, scanners) per instance without adding
// a Convex round trip per request. Warm instances share the maps; cold starts
// reset them, which is acceptable for abuse throttling, not strict quotas.

export type RateLimitResult = {
  allowed: boolean;
  retryAfterSeconds: number;
};

export type RateLimitOptions = {
  /** Maximum requests allowed per window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
};

const MAX_TRACKED_KEYS = 10_000;

const rateLimitWindows = new Map<
  string,
  { count: number; windowStart: number }
>();

export function rateLimit(
  key: string,
  options: RateLimitOptions
): RateLimitResult {
  const now = getCurrentUTCTimestamp();
  const entry = rateLimitWindows.get(key);

  if (!entry || now - entry.windowStart >= options.windowMs) {
    if (rateLimitWindows.size >= MAX_TRACKED_KEYS) {
      const oldestKey = rateLimitWindows.keys().next().value;
      if (oldestKey) rateLimitWindows.delete(oldestKey);
    }
    rateLimitWindows.set(key, { count: 1, windowStart: now });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (entry.count >= options.limit) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((entry.windowStart + options.windowMs - now) / 1000)
    );
    return { allowed: false, retryAfterSeconds };
  }

  entry.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}

/** Client IP for rate limiting on Vercel, falling back to a shared bucket. */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const firstHop = forwarded?.split(",")[0]?.trim();
  if (firstHop) return firstHop;
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

const MAX_MEMOIZED_KEYS = 1_000;

const memoizedValues = new Map<string, { value: unknown; expiresAt: number }>();
const memoizedInFlight = new Map<string, Promise<unknown>>();

/**
 * Deduplicate an expensive per-key computation with a TTL. Concurrent callers
 * for the same key share one in-flight promise; results are reused until the
 * TTL expires.
 */
export async function memoizeTtl<T>(
  key: string,
  ttlMs: number,
  load: () => Promise<T>
): Promise<T> {
  const now = getCurrentUTCTimestamp();
  const cached = memoizedValues.get(key);
  if (cached && cached.expiresAt > now) return cached.value as T;

  const inflight = memoizedInFlight.get(key);
  if (inflight) return inflight as Promise<T>;

  const promise = load()
    .then((value) => {
      if (memoizedValues.size >= MAX_MEMOIZED_KEYS) {
        const oldestKey = memoizedValues.keys().next().value;
        if (oldestKey) memoizedValues.delete(oldestKey);
      }
      memoizedValues.set(key, {
        value,
        expiresAt: getCurrentUTCTimestamp() + ttlMs,
      });
      return value;
    })
    .finally(() => {
      memoizedInFlight.delete(key);
    });
  memoizedInFlight.set(key, promise);
  return promise;
}
