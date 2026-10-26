import test from "node:test";
import assert from "node:assert/strict";
import {
  consumeRecoveryCode,
  createTwoFactorChallenge,
  decryptTotpSecret,
  encryptTotpSecret,
  generateRecoveryCodes,
  generateTotpSecret,
  totpAt,
  verifyTotp,
  verifyTwoFactorChallenge,
} from "../lib/twoFactor";

process.env.AUTH_SECRET ||= "test-auth-secret-with-at-least-32-characters";

test("implements the RFC 6238 SHA-1 reference vector", () => {
  const secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
  assert.equal(totpAt(secret, 59_000, 8).code, "94287082");
});

test("verifies current TOTP values with limited clock drift", () => {
  const secret = generateTotpSecret();
  const now = 1_800_000_000_000;
  const current = totpAt(secret, now);
  assert.equal(verifyTotp(secret, current.code, now), current.step);
  assert.equal(verifyTotp(secret, "000000", now), null);
});

test("encrypts authenticator secrets and rejects tampering", () => {
  const secret = generateTotpSecret();
  const encrypted = encryptTotpSecret(secret);
  assert.equal(encrypted.includes(secret), false);
  assert.equal(decryptTotpSecret(encrypted), secret);
  assert.throws(() => decryptTotpSecret(`${encrypted}x`));
});

test("signs short-lived login challenges", () => {
  const challenge = createTwoFactorChallenge("admin-id");
  assert.equal(verifyTwoFactorChallenge(challenge), "admin-id");
  assert.equal(verifyTwoFactorChallenge(`${challenge}x`), null);
});

test("recovery codes are stored as hashes and consumed once", () => {
  const recovery = generateRecoveryCodes();
  assert.equal(recovery.codes.length, 8);
  assert.equal(JSON.stringify(recovery.hashes).includes(recovery.codes[0]), false);
  const remaining = consumeRecoveryCode(JSON.stringify(recovery.hashes), recovery.codes[0]);
  assert.equal(remaining?.length, 7);
  assert.equal(consumeRecoveryCode(JSON.stringify(remaining), recovery.codes[0]), null);
});
