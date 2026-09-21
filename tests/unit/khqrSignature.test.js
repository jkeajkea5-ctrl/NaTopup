import assert from "node:assert";
import test from "node:test";
import { createHmacSha256, verifyHmacSha256 } from "../../apps/backend/lib/security";

test("HMAC SHA256 signature generation and constant-time verification", () => {
  const payload = JSON.stringify({
    orderReference: "TP-8K9F2A1M",
    amount: 5.0,
    currency: "USD",
  });
  const secret = "test_webhook_secret_key_12345";

  const signature = createHmacSha256(payload, secret);
  assert.ok(signature.length === 64); // 32 bytes in hex = 64 chars

  // Valid verification
  const isValid = verifyHmacSha256(payload, signature, secret);
  assert.strictEqual(isValid, true);

  // Tampered payload verification
  const tamperedPayload = JSON.stringify({
    orderReference: "TP-8K9F2A1M",
    amount: 0.01, // Hacker attempted to change price
    currency: "USD",
  });
  const isTamperedValid = verifyHmacSha256(tamperedPayload, signature, secret);
  assert.strictEqual(isTamperedValid, false);

  // Wrong secret
  const isWrongSecretValid = verifyHmacSha256(payload, signature, "wrong_secret");
  assert.strictEqual(isWrongSecretValid, false);
});
