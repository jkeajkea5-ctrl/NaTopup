import test from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../lib/prisma";
import { PaymentService } from "../services/PaymentService";
import { khqrClient } from "../payments/khqr/client";

test("paid, cancelled, and completed orders cannot generate another QR", async (t) => {
  let order: any;
  const original = prisma.order.findUnique;
  (prisma.order as any).findUnique = async () => order;
  t.after(() => { prisma.order.findUnique = original; });
  const generate = t.mock.method(khqrClient, "generatePayment", async () => { throw new Error("Unexpected QR creation"); });

  for (const status of ["PAID", "PROCESSING", "DELIVERED", "CANCELLED", "EXPIRED", "REFUNDED"]) {
    order = { id: "order-1", status };
    await assert.rejects(new PaymentService().getOrCreatePayment("NT-TEST01"), /no longer accept/);
  }
  order = { id: "order-1", status: "AWAITING_PAYMENT", payment: { status: "PAID" } };
  await assert.rejects(new PaymentService().getOrCreatePayment("NT-TEST01"), /no longer accept/);
  assert.equal(generate.mock.callCount(), 0);
});

test("concurrent payment initialization cannot reset the winning paid session", async (t) => {
  const originals = { order: prisma.order.findUnique, create: prisma.payment.create, payment: prisma.payment.findUnique };
  (prisma.order as any).findUnique = async () => ({
    id: "order-race", publicOrderId: "NT-INITRACE", status: "AWAITING_PAYMENT",
    events: [{ createdAt: new Date() }], payment: null, total: 1, totalKhr: 4100,
  });
  let attempts = 0;
  (prisma.payment as any).create = async () => {
    attempts++;
    throw Object.assign(new Error("Another initializer saved the payment"), { code: "P2002" });
  };
  (prisma.payment as any).findUnique = async () => ({
    id: "winning-payment", provider: "KHQRPAY_ABA_V2", status: "PAID",
    qrExpiresAt: new Date(Date.now() + 60000),
  });
  t.after(() => {
    prisma.order.findUnique = originals.order;
    prisma.payment.create = originals.create;
    prisma.payment.findUnique = originals.payment;
  });
  t.mock.method(khqrClient, "generatePayment", async () => ({
    orderReference: "provider-1", qrString: "qr-payload", md5: "hash", amount: 1,
    currency: "USD" as const, expiresAt: new Date(Date.now() + 60000),
  }));
  await assert.rejects(new PaymentService().getOrCreatePayment("NT-INITRACE"), /payment session changed/);
  assert.equal(attempts, 1);
});

test("expired sessions and provider switches preserve the original payment reference", async (t) => {
  let payment: any;
  const original = prisma.order.findUnique;
  (prisma.order as any).findUnique = async () => ({ id: "order-1", status: "AWAITING_PAYMENT", payment });
  t.after(() => { prisma.order.findUnique = original; });
  const generate = t.mock.method(khqrClient, "generatePayment", async () => { throw new Error("Unexpected QR creation"); });

  for (const existing of [
    { status: "EXPIRED", provider: "KHQRPAY_ABA_V2", qrExpiresAt: new Date(0) },
    { status: "PENDING", provider: "KHQRPAY_ABA_V2", qrExpiresAt: new Date(0) },
    { status: "PENDING", provider: "ANJAKPAY", qrExpiresAt: new Date(Date.now() + 60000) },
  ]) {
    payment = existing;
    await assert.rejects(new PaymentService().getOrCreatePayment("NT-TEST01"), /already has a payment session/);
  }
  assert.equal(generate.mock.callCount(), 0);
});
