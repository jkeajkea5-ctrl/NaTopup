import test from "node:test";
import assert from "node:assert/strict";
import { FulfilmentStatus, OrderStatus, PaymentStatus } from "@topup/shared";
import { prisma } from "../lib/prisma";
import { fulfilmentService } from "../services/FulfilmentService";
import { orderService } from "../services/OrderService";
import { supplierManager } from "../suppliers/supplierManager";

function mockFulfilment(status: FulfilmentStatus) {
  return {
    id: "fulfilment-1",
    orderId: "order-1",
    status,
    supplierOrderId: "supplier-order-1",
    order: { publicOrderId: "NT-BULK01" },
  };
}

test("never dispatches a supplier order when only the order status says paid", async (t) => {
  const originalFindUnique = prisma.order.findUnique;
  (prisma.order as any).findUnique = async () => ({
    id: "order-1",
    publicOrderId: "NT-UNPAID1",
    status: OrderStatus.PAID,
    payment: { status: PaymentStatus.PENDING },
    fulfilment: null,
    product: { mappings: [] },
  });
  t.after(() => {
    (prisma.order as any).findUnique = originalFindUnique;
  });
  const placeOrder = t.mock.method(supplierManager, "placeOrder", async () => {
    throw new Error("Supplier must not be called");
  });

  await fulfilmentService.processFulfilment("order-1");

  assert.equal(placeOrder.mock.callCount(), 0);
});

test("concurrent delivery confirmations emit one order transition", async (t) => {
  let claimed = false;
  let transitions = 0;

  const originalFindUnique = prisma.fulfilment.findUnique;
  const originalUpdateMany = prisma.fulfilment.updateMany;
  (prisma.fulfilment as any).findUnique = async () => mockFulfilment(FulfilmentStatus.PROCESSING);
  (prisma.fulfilment as any).updateMany = async () => {
    if (claimed) return { count: 0 };
    claimed = true;
    return { count: 1 };
  };
  t.after(() => {
    (prisma.fulfilment as any).findUnique = originalFindUnique;
    (prisma.fulfilment as any).updateMany = originalUpdateMany;
  });
  t.mock.method(orderService, "transitionStatus", async () => {
    transitions += 1;
    return {} as never;
  });

  const results = await Promise.all([
    fulfilmentService.markFulfilmentDelivered("fulfilment-1"),
    fulfilmentService.markFulfilmentDelivered("fulfilment-1"),
  ]);

  assert.deepEqual(results.sort(), [false, true]);
  assert.equal(transitions, 1);
});

test("concurrent supplier failures emit one review transition", async (t) => {
  let claimed = false;
  let transitions = 0;

  const originalFindUnique = prisma.fulfilment.findUnique;
  const originalUpdateMany = prisma.fulfilment.updateMany;
  (prisma.fulfilment as any).findUnique = async () => mockFulfilment(FulfilmentStatus.PROCESSING);
  (prisma.fulfilment as any).updateMany = async () => {
    if (claimed) return { count: 0 };
    claimed = true;
    return { count: 1 };
  };
  t.after(() => {
    (prisma.fulfilment as any).findUnique = originalFindUnique;
    (prisma.fulfilment as any).updateMany = originalUpdateMany;
  });
  t.mock.method(orderService, "transitionStatus", async () => {
    transitions += 1;
    return {} as never;
  });

  const results = await Promise.all([
    fulfilmentService.markFulfilmentFailedForReview("fulfilment-1", "Supplier rejected order"),
    fulfilmentService.markFulfilmentFailedForReview("fulfilment-1", "Supplier rejected order"),
  ]);

  assert.deepEqual(results.sort(), [false, true]);
  assert.equal(transitions, 1);
});

test("a late supplier failure cannot overwrite delivered fulfilment", async (t) => {
  let updates = 0;
  let transitions = 0;

  const originalFindUnique = prisma.fulfilment.findUnique;
  const originalUpdateMany = prisma.fulfilment.updateMany;
  (prisma.fulfilment as any).findUnique = async () => mockFulfilment(FulfilmentStatus.DELIVERED);
  (prisma.fulfilment as any).updateMany = async () => {
    updates += 1;
    return { count: 1 };
  };
  t.after(() => {
    (prisma.fulfilment as any).findUnique = originalFindUnique;
    (prisma.fulfilment as any).updateMany = originalUpdateMany;
  });
  t.mock.method(orderService, "transitionStatus", async () => {
    transitions += 1;
    return {} as never;
  });

  const changed = await fulfilmentService.markFulfilmentFailedForReview(
    "fulfilment-1",
    "Delayed failure callback"
  );

  assert.equal(changed, false);
  assert.equal(updates, 0);
  assert.equal(transitions, 0);
});
