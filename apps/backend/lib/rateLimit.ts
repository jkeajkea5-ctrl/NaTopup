import crypto from "node:crypto";
import { prisma } from "./prisma";

export interface RateLimitOptions {
  windowMs: number; // e.g. 60,000 for 1 minute
  maxRequests: number; // e.g. 30 requests per window
}

export async function checkRateLimit(
  identifier: string,
  options: RateLimitOptions = { windowMs: 60000, maxRequests: 60 }
): Promise<{ allowed: boolean; remaining: number; resetMs: number; unavailable?: boolean }> {
  const now = Date.now();
  const bucketStartMs = Math.floor(now / options.windowMs) * options.windowMs;
  const windowStart = new Date(bucketStartMs);
  const expiresAt = new Date(bucketStartMs + options.windowMs * 2);
  const key = crypto.createHash("sha256").update(identifier).digest("hex");
  const resetMs = bucketStartMs + options.windowMs - now;

  try {
    let claim = await prisma.apiRateLimit.updateMany({
      where: { key, windowStart, count: { lt: options.maxRequests } },
      data: { count: { increment: 1 }, expiresAt },
    });

    if (claim.count === 0) {
      try {
        await prisma.apiRateLimit.create({
          data: { key, windowStart, count: 1, expiresAt },
        });
        return { allowed: true, remaining: options.maxRequests - 1, resetMs };
      } catch {
        // Another instance may have created the bucket concurrently. Claim a
        // slot atomically; the count predicate prevents exceeding the limit.
        claim = await prisma.apiRateLimit.updateMany({
          where: { key, windowStart, count: { lt: options.maxRequests } },
          data: { count: { increment: 1 }, expiresAt },
        });
      }
    }

    if (claim.count !== 1) {
      return { allowed: false, remaining: 0, resetMs };
    }

    const bucket = await prisma.apiRateLimit.findUnique({
      where: { key_windowStart: { key, windowStart } },
      select: { count: true },
    });
    return {
      allowed: true,
      remaining: Math.max(0, options.maxRequests - (bucket?.count || options.maxRequests)),
      resetMs,
    };
  } catch {
    // Expensive anonymous endpoints fail closed when the shared limiter is
    // unavailable; otherwise an attacker could trigger an outage to bypass it.
    return { allowed: false, remaining: 0, resetMs, unavailable: true };
  }
}

export async function cleanupExpiredRateLimits(now = new Date()): Promise<number> {
  try {
    const result = await prisma.apiRateLimit.deleteMany({ where: { expiresAt: { lt: now } } });
    return result.count;
  } catch {
    // Cleanup is best-effort and must never make payment reconciliation fail.
    return 0;
  }
}
