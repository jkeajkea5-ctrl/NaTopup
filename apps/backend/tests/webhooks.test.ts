import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { extractSupplierCallback, inferG2BulkGameCode, paymentCurrencyMatches, verifyVizoWebhookSignature } from "../services/WebhookService";
import { generatePublicOrderId, timingSafeEqualHex } from "../lib/security";
import { isWebhookTimestampFresh, parseWebhookTimestamp } from "../payments/khqr/client";
import { g2bulkAdapter } from "../suppliers/g2bulk/client";
import { vizoAdapter } from "../suppliers/vizo/client";

test("verifies Vizo's documented sha256 HMAC format", () => {
  const body = JSON.stringify({ event: "order.completed", data: { transaction_id: "TX-1" } });
  const signature = `sha256=${crypto.createHmac("sha256", "test-key").update(body).digest("hex")}`;
  assert.equal(verifyVizoWebhookSignature(body, signature, "test-key"), true);
  assert.equal(verifyVizoWebhookSignature(`${body} `, signature, "test-key"), false);
  assert.equal(verifyVizoWebhookSignature(body, null, "test-key"), false);
});

test("compares provider hashes safely and rejects malformed hex", () => {
  assert.equal(timingSafeEqualHex("a".repeat(64), "a".repeat(64)), true);
  assert.equal(timingSafeEqualHex("a".repeat(64), "b".repeat(64)), false);
  assert.equal(timingSafeEqualHex("not-hex", "not-hex"), false);
});

test("accepts only fresh KHQR callback timestamps", () => {
  const now = Date.UTC(2026, 8, 24, 12, 0, 0);
  assert.equal(parseWebhookTimestamp("20260924120000"), now);
  assert.equal(parseWebhookTimestamp(String(now / 1000)), now);
  assert.equal(parseWebhookTimestamp(new Date(now).toISOString()), now);
  assert.equal(parseWebhookTimestamp("20261399120000"), null);
  assert.equal(isWebhookTimestampFresh("20260924120000", 300, now), true);
  assert.equal(isWebhookTimestampFresh(String(now / 1000), 300, now), true);
  assert.equal(isWebhookTimestampFresh(String((now - 301_000) / 1000), 300, now), false);
  assert.equal(isWebhookTimestampFresh("invalid", 300, now), false);
});

test("validates an explicit KHQR callback currency", () => {
  assert.equal(paymentCurrencyMatches(undefined, "USD"), true);
  assert.equal(paymentCurrencyMatches("usd", "USD"), true);
  assert.equal(paymentCurrencyMatches("KHR", "USD"), false);
});

test("infers the G2Bulk game required by its order status endpoint", () => {
  assert.equal(inferG2BulkGameCode("Mobile Legends"), "mlbb");
  assert.equal(inferG2BulkGameCode("Mobile Legends Philippines", "G2B_MLBB_EXCLUSIVE_55"), "mlbb_exclusive");
  assert.equal(inferG2BulkGameCode("Mobile Legends Indonesia", "G2B_MLBB_GLOBAL_55"), "mlbb_global");
  assert.equal(inferG2BulkGameCode("G2B_MLBB_55"), "mlbb");
  assert.equal(inferG2BulkGameCode("valorant_sg"), "valorant_sg");
});

test("extracts G2Bulk remarks and nested Vizo transaction IDs", () => {
  assert.deepEqual(extractSupplierCallback({ order_id: 42, remark: "NT-ABC" }), {
    data: { order_id: 42, remark: "NT-ABC" }, supplierOrderId: "42", referenceCode: "NT-ABC",
  });
  const vizo = extractSupplierCallback({ event: "order.completed", data: { transaction_id: "TX-1", status: "success" } });
  assert.equal(vizo.supplierOrderId, "TX-1");
});

test("uses the configured order prefix", () => {
  const previous = process.env.ORDER_PREFIX;
  process.env.ORDER_PREFIX = "NT";
  try {
    assert.match(generatePublicOrderId(), /^NT-[A-Z2-9]{8}$/);
  } finally {
    if (previous === undefined) delete process.env.ORDER_PREFIX;
    else process.env.ORDER_PREFIX = previous;
  }
});

test("supplier status connection failures never report delivery", async (t) => {
  t.mock.method(globalThis, "fetch", async () => { throw new Error("offline"); });
  const [g2bulk, vizo] = await Promise.all([
    g2bulkAdapter.getOrderStatus("G2-1"),
    vizoAdapter.getOrderStatus("VZ-1"),
  ]);
  assert.equal(g2bulk.isDelivered, false);
  assert.equal(vizo.isDelivered, false);
});
