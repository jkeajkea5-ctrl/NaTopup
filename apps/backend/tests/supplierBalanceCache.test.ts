import assert from "node:assert/strict";
import test from "node:test";
import {
  BALANCE_CACHE_TTL_MS,
  isBalanceCacheFresh,
  parseBalanceCache,
} from "../suppliers/supplierManager";

test("supplier balance cache suppresses refreshes for five minutes", () => {
  const now = Date.parse("2026-10-01T08:00:00.000Z");
  const recent = new Date(now - BALANCE_CACHE_TTL_MS + 1).toISOString();
  const expired = new Date(now - BALANCE_CACHE_TTL_MS).toISOString();

  assert.equal(isBalanceCacheFresh(recent, now), true);
  assert.equal(isBalanceCacheFresh(expired, now), false);
  assert.equal(isBalanceCacheFresh("invalid", now), false);
});

test("supplier balance cache rejects malformed persisted values", () => {
  assert.equal(parseBalanceCache(null), null);
  assert.equal(parseBalanceCache("not json"), null);
  assert.equal(parseBalanceCache(JSON.stringify({ balance: 10 })), null);
  assert.deepEqual(
    parseBalanceCache(JSON.stringify({ balance: 10, lastAttemptAt: "2026-10-01T08:00:00.000Z" })),
    { balance: 10, lastAttemptAt: "2026-10-01T08:00:00.000Z" }
  );
});
