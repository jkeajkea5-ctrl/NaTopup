import test from "node:test";
import assert from "node:assert/strict";
import { supplierManager } from "../suppliers/supplierManager";
import { prisma } from "../lib/prisma";
import { OrderService } from "../services/OrderService";
import { PaymentService } from "../services/PaymentService";
import { khqrClient } from "../payments/khqr/client";
import { g2bulkAdapter } from "../suppliers/g2bulk/client";
import { vizoAdapter } from "../suppliers/vizo/client";

function mockMethod(t: any, target: any, name: string, implementation: any) {
  const original = target[name];
  const mock = t.mock.fn(implementation);
  target[name] = mock;
  t.after(() => { target[name] = original; });
  return mock;
}

test("invalid players cannot create orders or initialize payments", async (t) => {
  t.mock.method(supplierManager, "checkPlayer", async () => ({ valid: false }));
  mockMethod(t, prisma.product, "findUnique", async () => ({
    id: "123456789012345678901234", isActive: true,
    game: { slug: "mobile-legends", isActive: true }, price: {},
  }));
  const create = mockMethod(t, prisma.order, "create", async () => { throw new Error("Unexpected order creation"); });
  await assert.rejects(new OrderService().createOrder({
    gameSlug: "mobile-legends", productId: "123456789012345678901234", playerData: { userId: "missing" },
  }), /could not be verified/);
  assert.equal(create.mock.callCount(), 0);

  const generate = t.mock.method(khqrClient, "generatePayment", async () => { throw new Error("Unexpected payment creation"); });
  for (const payment of [null, { status: "PENDING", qrExpiresAt: new Date(Date.now() + 60000) }]) {
    mockMethod(t, prisma.order, "findUnique", async () => ({
      id: "stored-order", game: { slug: "mobile-legends" }, playerData: '{"userId":"missing"}', payment,
    }));
    await assert.rejects(new PaymentService().getOrCreatePayment("NT123"), /could not be verified/);
  }
  assert.equal(generate.mock.callCount(), 0);
});

test("verification accepts confirmed accounts and normalizes game aliases", async (t) => {
  const check = t.mock.method(supplierManager, "checkPlayer", async () => ({ valid: true, playerName: "Player" }));
  const result = await supplierManager.requireVerifiedPlayer("free-fire-khsgmy", { userId: "123" });
  assert.equal(result.playerName, "Player");
  assert.deepEqual(check.mock.calls[0].arguments, ["free-fire", { userId: "123" }]);
});

test("verification service failures block checkout", async (t) => {
  t.mock.method(supplierManager, "checkPlayer", async () => { throw new Error("Service unavailable"); });
  await assert.rejects(supplierManager.requireVerifiedPlayer("mobile-legends", { userId: "123" }), /Service unavailable/);
});

test("Free Fire verification uses the supplier-specific SG/MY game code", () => {
  assert.equal((g2bulkAdapter as any).mapPlayerCheckGameCode("free-fire"), "freefire_sgmy");
  assert.equal((g2bulkAdapter as any).mapCatalogueGameCode("free-fire"), "free_fire");
});

test("Free Fire verification falls back to G2Bulk when Vizo is unavailable", async (t) => {
  t.mock.method(vizoAdapter, "checkPlayer", async () => ({
    valid: false,
    errorMessage: "Vizo player verification is temporarily unavailable.",
    extraData: { providerUnavailable: true },
  }));
  const fallback = t.mock.method(g2bulkAdapter, "checkPlayer", async () => ({
    valid: true,
    playerName: "loveXnt",
  }));

  const result = await supplierManager.checkPlayer("free-fire", { userId: "2560333065" });
  assert.equal(result.valid, true);
  assert.equal(result.playerName, "loveXnt");
  assert.equal(fallback.mock.callCount(), 1);
});
