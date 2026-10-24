import test from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../lib/prisma";
import { OrderService } from "../services/OrderService";

function mockMethod(t: any, target: any, name: string, implementation: any) {
  const original = target[name];
  const mock = t.mock.fn(implementation);
  target[name] = mock;
  t.after(() => { target[name] = original; });
  return mock;
}

test("reuses an equivalent active unpaid checkout before supplier verification", async (t) => {
  const activeOrder = {
    id: "active-order",
    publicOrderId: "NT-ACTIVE1",
    status: "AWAITING_PAYMENT",
    checkoutRequestId: "same-browser-request",
    activeCheckoutKey: "same-player-product",
    createdAt: new Date(),
  };
  const findUnique = mockMethod(t, prisma.order, "findUnique", async ({ where }: any) => {
    return where.activeCheckoutKey ? activeOrder : null;
  });
  const productLookup = mockMethod(t, prisma.product, "findUnique", async () => {
    throw new Error("Product lookup must not run for a reused checkout");
  });

  const result = await new OrderService().createOrder({
    gameSlug: "mobile-legends",
    productId: "123456789012345678901234",
    playerData: { userId: "123", zoneId: "456" },
    activeCheckoutKey: "same-player-product",
    checkoutRequestId: "same-browser-request",
  });

  assert.equal(result.publicOrderId, "NT-ACTIVE1");
  assert.equal(findUnique.mock.callCount(), 2);
  assert.equal(productLookup.mock.callCount(), 0);
});

test("does not expose an active checkout to a different browser request", async (t) => {
  mockMethod(t, prisma.order, "findUnique", async ({ where }: any) => {
    if (!where.activeCheckoutKey) return null;
    return {
      id: "private-order",
      publicOrderId: "NT-PRIVATE1",
      publicLookupToken: "must-not-be-returned",
      checkoutRequestId: "original-browser-request",
      status: "AWAITING_PAYMENT",
      activeCheckoutKey: "same-player-product",
      createdAt: new Date(),
    };
  });

  await assert.rejects(
    new OrderService().createOrder({
      gameSlug: "mobile-legends",
      productId: "123456789012345678901234",
      playerData: { userId: "123", zoneId: "456" },
      activeCheckoutKey: "same-player-product",
      checkoutRequestId: "attacker-or-new-browser",
    }),
    /unpaid checkout already exists/
  );
});
