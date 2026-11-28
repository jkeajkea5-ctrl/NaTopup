import test from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../lib/prisma";
import { GET } from "../app/api/orders/[publicId]/status/route";
import { khqrClient } from "../payments/khqr/client";
import { reconciliationService } from "../services/ReconciliationService";
import { orderService } from "../services/OrderService";

function replace(t: any, target: any, name: string, implementation: any) {
  const original = target[name];
  target[name] = implementation;
  t.after(() => { target[name] = original; });
}

test("status polling verifies each saved payment with its own gateway", async (t) => {
  replace(t, prisma.apiRateLimit, "updateMany", async () => ({ count: 1 }));
  replace(t, prisma.apiRateLimit, "findUnique", async () => ({ count: 1 }));
  const verify = t.mock.method(khqrClient, "verifyPayment", async (_input: Parameters<typeof khqrClient.verifyPayment>[0]) => ({ paid: false, status: "PENDING" as const }));

  for (const provider of ["KHQRPAY_ABA_V2", "ANJAKPAY"]) {
    const publicId = `NT-${provider}`;
    replace(t, prisma.order, "findUnique", async ({ include }: any) => {
      assert.equal(include.payment.select.provider, true);
      return {
        id: "order-1", publicOrderId: publicId, publicLookupToken: "private-token",
        status: "AWAITING_PAYMENT", createdAt: new Date(),
        payment: { id: "payment-1", provider, status: "PENDING", amount: 1, currency: "USD",
          providerTransactionId: "provider-1", qrExpiresAt: new Date(Date.now() + 60000) },
      };
    });
    const response = await GET(new Request(`http://localhost/api/orders/${publicId}/status`, {
      headers: { "X-Order-Lookup-Token": "private-token" },
    }), { params: { publicId } });
    assert.equal(response.status, 200);
    assert.equal(verify.mock.calls.at(-1)?.arguments[0].provider, provider);
  }
  assert.equal(verify.mock.callCount(), 2);
});

test("expiry reconciliation cannot downgrade a concurrently paid payment", async (t) => {
  let reads = 0;
  replace(t, prisma.payment, "findMany", async () => reads++ === 0 ? [{
    id: "payment-race", status: "PENDING", createdAt: new Date(),
    qrExpiresAt: new Date(0), provider: "KHQRPAY_ABA_V2",
    order: { id: "order-race", publicOrderId: "NT-EXPIRY" },
  }] : []);
  t.mock.method(khqrClient, "verifyPayment", async () => ({ paid: false, status: "PENDING" as const }));
  replace(t, prisma.payment, "updateMany", async ({ where }: any) => {
    assert.deepEqual(where.status, { in: ["PENDING", "VERIFYING"] });
    return { count: 0 }; // Payment was confirmed after the initial read.
  });
  const transition = t.mock.method(orderService, "transitionStatus", async () => ({} as never));
  await reconciliationService.reconcilePendingPayments();
  assert.equal(transition.mock.callCount(), 0);
});

test("reconciliation does not poll payments already marked expired", async (t) => {
  let findManyCalls = 0;
  replace(t, prisma.payment, "findMany", async ({ where }: any) => {
    findManyCalls++;
    assert.deepEqual(where.status, { in: ["PENDING", "VERIFYING"] });
    return [];
  });
  const verify = t.mock.method(khqrClient, "verifyPayment", async () => {
    throw new Error("Expired payments must not reach the provider");
  });

  const result = await reconciliationService.reconcilePendingPayments();

  assert.deepEqual(result, { checked: 0, resolved: 0 });
  assert.equal(findManyCalls, 1);
  assert.equal(verify.mock.callCount(), 0);
});
