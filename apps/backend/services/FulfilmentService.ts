import {
  FulfilmentStatus,
  isSupplierPriceSafe,
  OrderStatus,
  SupplierCode,
  SupplierOrderStatus,
} from "@topup/shared";
import { config } from "../lib/config";
import { logger } from "../lib/logger";
import { prisma } from "../lib/prisma";
import { supplierManager } from "../suppliers/supplierManager";
import { orderService } from "./OrderService";

export class FulfilmentService {
  /**
   * Executes fulfilment for a verified PAID order.
   * Enforces single-fulfilment idempotency and price surge protection.
   */
  async processFulfilment(orderId: string): Promise<void> {
    // 1. Verify order exists and is eligible for fulfilment
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        product: {
          include: {
            mappings: {
              where: { isEnabled: true },
              orderBy: { priority: "asc" },
              include: {
                supplier: true,
                supplierProduct: true,
              },
            },
          },
        },
        fulfilment: true,
      },
    });

    if (!order) {
      throw new Error(`Order ${orderId} not found`);
    }

    // BUSINESS RULE: NO VERIFIED PAYMENT = NO SUPPLIER ORDER
    const recoverableQueuedDispatch =
      order.status === OrderStatus.PROCESSING &&
      order.fulfilment?.status === FulfilmentStatus.QUEUED;
    if (
      order.status !== OrderStatus.PAID &&
      order.status !== OrderStatus.FULFILMENT_QUEUED &&
      !recoverableQueuedDispatch
    ) {
      logger.warn("Refusing fulfilment: Order is not paid", {
        orderId: order.publicOrderId,
        status: order.status,
      });
      return;
    }

    // BUSINESS RULE: ONE VERIFIED PAYMENT = MAXIMUM ONE FULFILMENT
    if (order.fulfilment && order.fulfilment.status !== FulfilmentStatus.QUEUED) {
      logger.info("Fulfilment is already claimed or completed, skipping duplicate dispatch", {
        orderId: order.publicOrderId,
        status: order.fulfilment.status,
      });
      return;
    }

    // 2. Select Supplier Mapping
    const primaryMapping = order.product.mappings[0];
    if (!primaryMapping) {
      logger.error("No active supplier mapping found for product", {
        orderId: order.publicOrderId,
        productId: order.productId,
      });
      await orderService.transitionStatus(
        order.id,
        OrderStatus.REVIEW_REQUIRED,
        "No active supplier mapping configured"
      );
      return;
    }

    const supplierCode = primaryMapping.supplier.code as SupplierCode;
    const supplierProd = primaryMapping.supplierProduct;

    // 3. Price Protection Check
    const expectedCost = order.supplierCostSnapshot;
    const currentCost = supplierProd.currentCost;
    const priceSafety = isSupplierPriceSafe(
      expectedCost,
      currentCost,
      config.business.maxPriceSurgePercent
    );

    if (!priceSafety.safe) {
      logger.warn("Supplier price protection triggered, moving to REVIEW_REQUIRED", {
        orderId: order.publicOrderId,
        expectedCost,
        currentCost,
        diffPercent: priceSafety.diffPercent,
      });

      await orderService.transitionStatus(
        order.id,
        OrderStatus.REVIEW_REQUIRED,
        priceSafety.reason || "Supplier cost surged beyond safety margin"
      );
      return;
    }

    // 4. Create or Lock Fulfilment Record atomically
    const idempotencyKey = `FULFIL-${order.publicOrderId}`;
    let fulfilment = order.fulfilment;

    if (!fulfilment) {
      try {
        fulfilment = await prisma.fulfilment.create({
          data: {
            orderId: order.id,
            supplier: supplierCode,
            status: FulfilmentStatus.QUEUED,
            supplierCost: currentCost,
            idempotencyKey,
            attemptCount: 0,
          },
        });
      } catch (err: any) {
        // Handled by unique constraint on idempotencyKey
        logger.warn("Concurrent fulfilment attempt intercepted by idempotency key", {
          orderId: order.publicOrderId,
        });
        return;
      }
    }

    // 5. Transition order to PROCESSING
    await orderService.transitionStatus(
      order.id,
      OrderStatus.PROCESSING,
      `Order submitted to ${supplierCode} for delivery`
    );

    // Claim the durable queue record before calling a supplier. This prevents
    // a webhook and the recovery cron from dispatching the same paid order at
    // the same time.
    const claimed = await prisma.fulfilment.updateMany({
      where: { id: fulfilment.id, status: FulfilmentStatus.QUEUED },
      data: {
        status: FulfilmentStatus.PROCESSING,
        attemptCount: { increment: 1 },
        lastCheckedAt: new Date(),
      },
    });
    if (claimed.count !== 1) {
      logger.info("Fulfilment dispatch was claimed by another worker", {
        orderId: order.publicOrderId,
      });
      return;
    }

    // 6. Submit Order to Supplier Gateway
    // The public order ID is already unique and lets supplier callbacks map
    // directly to the order regardless of the configured ORDER_PREFIX.
    const referenceId = order.publicOrderId;
    const supplierOrderInput = {
      supplierCode,
      supplierProductCode: supplierProd.supplierProductCode,
      supplierGameCode: supplierProd.supplierGameCode,
      referenceId,
      playerId: order.playerId,
      serverId: order.serverId || undefined,
      extraFields: JSON.parse(order.playerData || "{}"),
    };

    logger.info("Dispatching order to supplier gateway", {
      orderId: order.publicOrderId,
      provider: supplierCode,
      supplierProduct: supplierProd.supplierProductCode,
    });

    const result = await supplierManager.placeOrder(supplierOrderInput);

    // 7. Record Supplier Order record in DB
    await prisma.supplierOrder.create({
      data: {
        fulfilmentId: fulfilment.id,
        supplier: supplierCode,
        supplierOrderId: result.supplierOrderId || referenceId,
        referenceCode: referenceId,
        status: result.supplierStatus,
        cost: result.supplierCost || currentCost,
        requestPayload: JSON.stringify({
          productId: supplierProd.supplierProductCode,
          playerId: order.playerId,
        }),
        responsePayload: JSON.stringify(result.rawResponse || {}),
      },
    });

    // 8. Update Fulfilment Status
    if (result.success) {
      await prisma.fulfilment.update({
        where: { id: fulfilment.id },
        data: {
          supplierOrderId: result.supplierOrderId,
          supplierCost: result.supplierCost,
        },
      });

      // If supplier marked it immediately completed (instant delivery):
      if (result.supplierStatus === SupplierOrderStatus.COMPLETED) {
        await this.markFulfilmentDelivered(fulfilment.id);
      }
    } else {
      await prisma.fulfilment.update({
        where: { id: fulfilment.id },
        data: {
          status: FulfilmentStatus.FAILED,
          lastError: result.errorMessage || "Supplier rejected top-up",
        },
      });

      // The customer has already paid at this point. A supplier rejection is
      // not a failed invoice: it requires a safe manual resolution (correct
      // package/account, retry, or refund) and must never trigger a blind
      // repeat order.
      await orderService.transitionStatus(
        order.id,
        OrderStatus.REVIEW_REQUIRED,
        result.errorMessage || "Supplier purchase requires review"
      );
    }
  }

  /**
   * Marks fulfilment and customer order as DELIVERED.
   */
  async markFulfilmentDelivered(fulfilmentId: string): Promise<void> {
    const fulfilment = await prisma.fulfilment.findUnique({
      where: { id: fulfilmentId },
      include: { order: true },
    });

    if (!fulfilment || fulfilment.status === FulfilmentStatus.DELIVERED) {
      return;
    }

    await prisma.fulfilment.update({
      where: { id: fulfilmentId },
      data: {
        status: FulfilmentStatus.DELIVERED,
        completedAt: new Date(),
      },
    });

    await orderService.transitionStatus(
      fulfilment.orderId,
      OrderStatus.DELIVERED,
      "Top-up successfully delivered to in-game account"
    );

    logger.info("Order marked as DELIVERED successfully", {
      orderId: fulfilment.order.publicOrderId,
      supplierOrderId: fulfilment.supplierOrderId || undefined,
    });
  }
}

export const fulfilmentService = new FulfilmentService();
