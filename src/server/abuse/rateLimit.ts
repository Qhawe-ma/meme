type Bucket = number[];

const buckets: Map<string, Bucket> = new Map();

export function rateLimit(key: string, limit: number, windowMs: number): { ok: true } | { ok: false; retryAfterS: number } {
  if (process.env.RATE_LIMIT_DISABLED === "1") return { ok: true };
  const now = Date.now();
  const recent = (buckets.get(key) ?? []).filter((stamp) => now - stamp < windowMs);
  if (recent.length >= limit) {
    const oldest = recent[0] ?? now;
    return { ok: false, retryAfterS: Math.max(1, Math.ceil((oldest + windowMs - now) / 1000)) };
  }
  recent.push(now);
  buckets.set(key, recent);
  return { ok: true };
}

export function assertRate(key: string, limit: number, windowMs: number) {
  const result = rateLimit(key, limit, windowMs);
  if (!result.ok) {
    const error = new Error("RATE_LIMITED");
    (error as { retryAfterS?: number }).retryAfterS = result.retryAfterS;
    throw error;
  }
}
