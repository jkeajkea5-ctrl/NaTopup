import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { extractSupplierCallback, inferG2BulkGameCode, verifyVizoWebhookSignature } from "../services/WebhookService";
import { generatePublicOrderId } from "../lib/security";
import { g2bulkAdapter } from "../suppliers/g2bulk/client";
import { vizoAdapter } from "../suppliers/vizo/client";

test("verifies Vizo's documented sha256 HMAC format", () => {
  const body = JSON.stringify({ event: "order.completed", data: { transaction_id: "TX-1" } });
  const signature = `sha256=${crypto.createHmac("sha256", "test-key").update(body).digest("hex")}`;
  assert.equal(verifyVizoWebhookSignature(body, signature, "test-key"), true);
  assert.equal(verifyVizoWebhookSignature(`${body} `, signature, "test-key"), false);
  assert.equal(verifyVizoWebhookSignature(body, null, "test-key"), false);
});

test("infers the G2Bulk game required by its order status endpoint", () => {
  assert.equal(inferG2BulkGameCode("Mobile Legends"), "mlbb");
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
