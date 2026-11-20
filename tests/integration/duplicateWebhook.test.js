import assert from "node:assert/strict";
import test from "node:test";
import { prisma } from "../../apps/backend/lib/prisma.ts";
import { khqrClient } from "../../apps/backend/payments/khqr/client.ts";
import { webhookService } from "../../apps/backend/services/WebhookService.ts";
import { orderService } from "../../apps/backend/services/OrderService.ts";
import { fulfilmentService } from "../../apps/backend/services/FulfilmentService.ts";

// Exercise real webhook handling without a live database, bank transaction,
// seeded catalogue, or supplier purchase.
test("10 concurrent authenticated callbacks claim one payment and dispatch once", async (t) => {
  const payment = {
    id: "payment-1", status: "PENDING", amount: 5, currency: "USD",
    provider: "KHQRPAY_ABA_V2", providerTransactionId: "provider-1",
  };
  let event;
  let claims = 0;
  const replace = (target, name, implementation) => {
    const original = target[name];
    target[name] = implementation;
    t.after(() => { target[name] = original; });
  };
  replace(prisma.webhookEvent, "findUnique", async () => event ? { ...event } : null);
  replace(prisma.webhookEvent, "create", async () => {
    if (event) throw Object.assign(new Error("Duplicate"), { code: "P2002" });
    event = { id: "event-1", processed: false };
    return { ...event };
  });
  replace(prisma.webhookEvent, "update", async ({ data }) => Object.assign(event, data));
  replace(prisma.order, "findUnique", async () => ({
    id: "order-1", publicOrderId: "NT-TEST01", status: "AWAITING_PAYMENT", payment: { ...payment },
  }));
  replace(prisma.payment, "updateMany", async () => {
    if (payment.status === "PAID") return { count: 0 };
    payment.status = "PAID";
    claims++;
    return { count: 1 };
  });
  t.mock.method(khqrClient, "verifyWebhook", () => true);
  t.mock.method(khqrClient, "verifyPayment", async () => ({
    paid: true, status: "PAID", paidAmount: 5, currency: "USD", transactionId: "provider-1",
  }));
  const transition = t.mock.method(orderService, "transitionStatus", async () => ({}));
  const dispatch = t.mock.method(fulfilmentService, "processFulfilment", async () => {});

  const rawBody = JSON.stringify({ orderReference: "NT-TEST01", transactionId: "provider-1", amount: 5, currency: "USD", status: "PAID" });
  const results = await Promise.all(Array.from({ length: 10 }, () => webhookService.handleKhqrWebhook(rawBody, "test-signature")));

  assert.ok(results.every((result) => result.success && result.statusCode === 200));
  assert.equal(payment.status, "PAID");
  assert.equal(claims, 1);
  assert.equal(transition.mock.callCount(), 1);
  assert.equal(dispatch.mock.callCount(), 1);
  assert.equal(event.processed, true);
});
