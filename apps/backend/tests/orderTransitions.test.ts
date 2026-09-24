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
