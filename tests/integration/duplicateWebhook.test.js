import assert from "node:assert";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import { webhookService } from "../../apps/backend/services/WebhookService.js";
import { orderService } from "../../apps/backend/services/OrderService.js";
import { paymentService } from "../../apps/backend/services/PaymentService.js";

const prisma = new PrismaClient();

test("Critical Duplicate Test: 10 concurrent payment webhooks result in exactly 1 payment and 1 fulfilment", async () => {
  // 1. Fetch any seeded game & product
  const product = await prisma.product.findFirst({
    where: { isActive: true },
    include: { game: true, price: true },
  });
  assert.ok(product, "Product should exist in seeded database");

  // 2. Create Order
  const order = await orderService.createOrder({
    gameSlug: product.game.slug,
    productId: product.id,
    playerData: { userId: "123456789", zoneId: "1234" },
    currency: "USD",
  });
  assert.ok(order.publicOrderId);

  // 3. Generate Payment
  const payment = await paymentService.getOrCreatePayment(order.publicOrderId);
  assert.strictEqual(payment.status, "PENDING");

  // 4. Construct KHQR Webhook payload
  const webhookPayload = JSON.stringify({
    orderReference: order.publicOrderId,
    transactionId: `TXN-BAKONG-${Date.now()}`,
    amount: order.total,
    currency: "USD",
    status: "PAID",
  });

  // 5. Fire 10 concurrent webhooks simultaneously
  const results = await Promise.all(
    Array.from({ length: 10 }).map(() =>
      webhookService.handleKhqrWebhook(webhookPayload, null)
    )
  );

  // Assert all 10 calls succeed without 500 error
  for (const res of results) {
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.statusCode, 200);
  }

  // Allow asynchronous fulfilment worker cycle to process
  await new Promise((resolve) => setTimeout(resolve, 800));

  // 6. Verify Database State
  const finalPayment = await prisma.payment.findUnique({
    where: { orderId: order.id },
  });
  assert.strictEqual(finalPayment.status, "PAID");

  const fulfilments = await prisma.fulfilment.findMany({
    where: { orderId: order.id },
  });
  // Exactly ONE fulfilment record!
  assert.strictEqual(fulfilments.length, 1, "Must have exactly 1 fulfilment record");

  const supplierOrders = await prisma.supplierOrder.findMany({
    where: { fulfilmentId: fulfilments[0].id },
  });
  // Exactly ONE supplier purchase!
  assert.strictEqual(supplierOrders.length, 1, "Must have exactly 1 supplier purchase");

  const finalOrder = await prisma.order.findUnique({
    where: { id: order.id },
  });
  assert.ok(
    finalOrder.status === "DELIVERED" || finalOrder.status === "PROCESSING",
    `Order status should be PROCESSING or DELIVERED, got ${finalOrder.status}`
  );
});
