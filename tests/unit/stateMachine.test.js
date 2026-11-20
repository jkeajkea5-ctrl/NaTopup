import assert from "node:assert";
import test from "node:test";
import { canTransitionOrder, OrderStatus } from "../../packages/shared/src/enums.ts";

test("Order state machine permits valid transitions", () => {
  assert.strictEqual(canTransitionOrder(OrderStatus.CREATED, OrderStatus.AWAITING_PAYMENT), true);
  assert.strictEqual(canTransitionOrder(OrderStatus.AWAITING_PAYMENT, OrderStatus.PAID), true);
  assert.strictEqual(canTransitionOrder(OrderStatus.PAID, OrderStatus.FULFILMENT_QUEUED), true);
  assert.strictEqual(canTransitionOrder(OrderStatus.FULFILMENT_QUEUED, OrderStatus.PROCESSING), true);
  assert.strictEqual(canTransitionOrder(OrderStatus.PROCESSING, OrderStatus.DELIVERED), true);
});

test("Order state machine rejects illegal shortcut transitions", () => {
  // Never jump straight from AWAITING_PAYMENT to DELIVERED without verified payment!
  assert.strictEqual(canTransitionOrder(OrderStatus.AWAITING_PAYMENT, OrderStatus.DELIVERED), false);
  // Terminal DELIVERED cannot transition back to PROCESSING
  assert.strictEqual(canTransitionOrder(OrderStatus.DELIVERED, OrderStatus.PROCESSING), false);
  // EXPIRED orders cannot skip verified payment and jump to delivery.
  assert.strictEqual(canTransitionOrder(OrderStatus.EXPIRED, OrderStatus.DELIVERED), false);
});

test("Order state machine recovers a provider-confirmed payment after local expiry", () => {
  assert.strictEqual(canTransitionOrder(OrderStatus.EXPIRED, OrderStatus.PAID), true);
});

test("a dismissed bank QR can still settle and a paid delivery can require review", () => {
  assert.strictEqual(canTransitionOrder(OrderStatus.CANCELLED, OrderStatus.PAID), true);
  assert.strictEqual(canTransitionOrder(OrderStatus.CANCELLED, OrderStatus.DELIVERED), false);
  assert.strictEqual(canTransitionOrder(OrderStatus.PAID, OrderStatus.REVIEW_REQUIRED), true);
  assert.strictEqual(canTransitionOrder(OrderStatus.PAYMENT_VERIFYING, OrderStatus.CANCELLED), true);
});
