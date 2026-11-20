import test from "node:test";
import assert from "node:assert/strict";
import { OrderStatus } from "@topup/shared";
import { prisma } from "../lib/prisma";
import { orderService } from "../services/OrderService";
import { telegramAlertService } from "../services/TelegramAlertService";

test("a repeated PAID transition does not create another event or Telegram alert", async (t) => {
  let updates = 0;
  let alerts = 0;
  const originalFindUnique = prisma.order.findUnique;
  const originalUpdate = prisma.order.update;

  (prisma.order as any).findUnique = async () => ({
    id: "order-1",
    publicOrderId: "NA-DUPPAID",
    status: OrderStatus.PAID,
  });
  (prisma.order as any).update = async () => {
    updates += 1;
    return {};
  };
  t.after(() => {
    (prisma.order as any).findUnique = originalFindUnique;
    (prisma.order as any).update = originalUpdate;
  });
  t.mock.method(telegramAlertService, "notifyOrderStatus", async () => {
    alerts += 1;
    return true;
  });

  const order = await orderService.transitionStatus(
    "order-1",
    OrderStatus.PAID,
    "Duplicate provider confirmation"
  );

  assert.equal(order.status, OrderStatus.PAID);
  assert.equal(updates, 0);
  assert.equal(alerts, 0);
});

test("a stale cancellation cannot overwrite a concurrently confirmed payment", async (t) => {
  let reads = 0;
  const originalFind = prisma.order.findUnique;
  const originalUpdate = prisma.order.update;
  (prisma.order as any).findUnique = async () => ({
    id: "order-race", publicOrderId: "NT-RACE01",
    status: reads++ === 0 ? OrderStatus.AWAITING_PAYMENT : OrderStatus.PAID,
  });
  (prisma.order as any).update = async ({ where }: any) => {
    assert.equal(where.status, OrderStatus.AWAITING_PAYMENT);
    throw Object.assign(new Error("State changed"), { code: "P2025" });
  };
  t.after(() => { prisma.order.findUnique = originalFind; prisma.order.update = originalUpdate; });
  const alert = t.mock.method(telegramAlertService, "deliverOrderEvent", async () => true as never);
  const result = await orderService.transitionStatus("order-race", OrderStatus.CANCELLED, "Customer closed QR");
  assert.equal(result.status, OrderStatus.PAID);
  assert.equal(alert.mock.callCount(), 0);
});

test("failed durable transitions never report success from memory", async (t) => {
  const originalFind = prisma.order.findUnique;
  const originalUpdate = prisma.order.update;
  (prisma.order as any).findUnique = async () => ({
    id: "order-offline", publicOrderId: "NT-OFFLINE", status: OrderStatus.AWAITING_PAYMENT,
  });
  (prisma.order as any).update = async () => { throw new Error("Database unavailable"); };
  t.after(() => { prisma.order.findUnique = originalFind; prisma.order.update = originalUpdate; });
  await assert.rejects(orderService.transitionStatus("order-offline", OrderStatus.PAID, "Provider confirmed"), /Database unavailable/);
});
