import crypto from "node:crypto";

const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$/;

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const candidate = forwarded || request.headers.get("x-real-ip")?.trim() || "unknown";
  return candidate.slice(0, 64);
}

export function getOrderLookupToken(request: Request): string {
  return request.headers.get("x-order-lookup-token")?.trim() || "";
}

export function verifyOrderLookupToken(candidate: string, expected: string): boolean {
  if (!candidate || !expected || candidate.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(candidate), Buffer.from(expected));
}

export function getCheckoutIdempotencyKey(request: Request): string | null {
  const value = request.headers.get("idempotency-key")?.trim() || "";
  return IDEMPOTENCY_KEY_PATTERN.test(value) ? value : null;
}

export function hashCheckoutRequest(input: Record<string, unknown>): string {
  const canonicalize = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(canonicalize);
    if (value && typeof value === "object") {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>)
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([key, nested]) => [key, canonicalize(nested)])
      );
    }
    return value;
  };
  return crypto.createHash("sha256").update(JSON.stringify(canonicalize(input))).digest("hex");
}

export function rateLimitHeaders(limit: { remaining: number; resetMs: number }): Record<string, string> {
  return {
    "X-RateLimit-Remaining": String(limit.remaining),
    "Retry-After": String(Math.max(1, Math.ceil(limit.resetMs / 1000))),
  };
}
