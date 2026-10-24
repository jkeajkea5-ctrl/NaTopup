import test from "node:test";
import assert from "node:assert/strict";
import {
  getCheckoutIdempotencyKey,
  getClientIp,
  hashCheckoutRequest,
  verifyOrderLookupToken,
} from "../lib/requestSecurity";

test("validates checkout idempotency keys", () => {
  assert.equal(getCheckoutIdempotencyKey(new Request("https://example.test", {
    headers: { "Idempotency-Key": "checkout-1234567890" },
  })), "checkout-1234567890");
  assert.equal(getCheckoutIdempotencyKey(new Request("https://example.test", {
    headers: { "Idempotency-Key": "short" },
  })), null);
});

test("hashes semantically identical checkout bodies consistently", () => {
  assert.equal(
    hashCheckoutRequest({ gameSlug: "mlbb", playerData: { zoneId: "2", userId: "1" } }),
    hashCheckoutRequest({ playerData: { userId: "1", zoneId: "2" }, gameSlug: "mlbb" })
  );
  assert.notEqual(hashCheckoutRequest({ productId: "one" }), hashCheckoutRequest({ productId: "two" }));
});

test("requires an exact private lookup token", () => {
  const token = "private-token-1234567890";
  assert.equal(verifyOrderLookupToken(token, token), true);
  assert.equal(verifyOrderLookupToken("private-token-xxxxxxxxxx", token), false);
  assert.equal(verifyOrderLookupToken("", token), false);
});

test("normalizes the first forwarded client address", () => {
  const request = new Request("https://example.test", {
    headers: { "X-Forwarded-For": "203.0.113.5, 10.0.0.1" },
  });
  assert.equal(getClientIp(request), "203.0.113.5");
});
