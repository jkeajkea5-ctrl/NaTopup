import { FulfilmentStatus, OrderStatus, PaymentStatus } from "@topup/shared";
import { logger } from "../lib/logger";
import { prisma } from "../lib/prisma";
import { khqrClient } from "../payments/khqr/client";
import { supplierManager } from "../suppliers/supplierManager";
import { fulfilmentService } from "./FulfilmentService";
import { orderService } from "./OrderService";

export class ReconciliationService {
  /**
   * Reconciles pending payments with the payment provider.
   */
  async reconcilePendingPayments(): Promise<{ checked: number; resolved: number }> {
    const now = new Date();
    const pendingPayments = await prisma.payment.findMany({
      where: {
        status: { in: [PaymentStatus.PENDING, PaymentStatus.VERIFYING] },
        qrExpiresAt: { gt: new Date(now.getTime() - 15 * 60 * 1000) }, // within 15 min window
      },
      include: { order: true },
    });

    let resolved = 0;
    for (const payment of pendingPayments) {
      try {
        const verifyResult = await khqrClient.verifyPayment({
          md5: payment.md5Hash || undefined,
          orderReference: payment.order.publicOrderId,
          transactionId: payment.providerTransactionId || undefined,
        });

        if (verifyResult.paid) {
          await prisma.payment.update({
            where: { id: payment.id },
            data: {
              status: PaymentStatus.PAID,
              providerTransactionId: verifyResult.transactionId || `TXN-REC-${Date.now()}`,
              paidAt: new Date(),
              verifiedAt: new Date(),
            },
          });

          await orderService.transitionStatus(
            payment.order.id,
            OrderStatus.PAID,
            "Reconciliation confirmed payment via provider check"
          );

          await fulfilmentService.processFulfilment(payment.order.id);
          resolved++;
        } else if (now > payment.qrExpiresAt) {
          // Payment expired
          await prisma.payment.update({
            where: { id: payment.id },
            data: { status: PaymentStatus.EXPIRED },
          });

          await orderService.transitionStatus(
            payment.order.id,
            OrderStatus.EXPIRED,
            "Payment session expired"
          );
        }
      } catch (err: any) {
        logger.error("Error reconciling payment", {
          paymentId: payment.id,
          orderId: payment.order.publicOrderId,
          error: err.message,
        });
      }
    }

    return { checked: pendingPayments.length, resolved };
  }

  /**
   * Reconciles pending supplier fulfilments.
   */
  async reconcilePendingFulfilments(): Promise<{ checked: number; updated: number }> {
    // Recover paid orders that were acknowledged but whose original webhook
    // invocation ended before supplier dispatch completed. This path does not
    // depend on the customer returning to or polling the website.
    const undispatchedOrders = await prisma.order.findMany({
      where: {
        status: { in: [OrderStatus.PAID, OrderStatus.FULFILMENT_QUEUED] },
        payment: { is: { status: PaymentStatus.PAID } },
      },
      select: { id: true, publicOrderId: true },
      take: 50,
    });

    let updated = 0;
    for (const order of undispatchedOrders) {
      try {
        await fulfilmentService.processFulfilment(order.id);
        updated++;
      } catch (err: any) {
        logger.error("Error recovering paid order fulfilment", {
          orderId: order.publicOrderId,
          error: err.message,
        });
      }
    }

    // Also recover the narrow crash window between creating the durable queue
    // row and claiming it for supplier dispatch.
    const queuedFulfilments = await prisma.fulfilment.findMany({
      where: { status: FulfilmentStatus.QUEUED },
      select: { orderId: true, order: { select: { publicOrderId: true } } },
      take: 50,
    });
    for (const fulfilment of queuedFulfilments) {
      try {
        await fulfilmentService.processFulfilment(fulfilment.orderId);
        updated++;
      } catch (err: any) {
        logger.error("Error recovering queued fulfilment", {
          orderId: fulfilment.order.publicOrderId,
          error: err.message,
        });
      }
    }

    const pendingFulfilments = await prisma.fulfilment.findMany({
      where: {
        status: FulfilmentStatus.PROCESSING,
        supplierOrderId: { not: null },
      },
      include: {
        order: true,
        supplierOrders: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    });

    for (const fulfilment of pendingFulfilments) {
      if (!fulfilment.supplierOrderId) continue;

      try {
        const supplierOrder = fulfilment.supplierOrders[0];
        let supplierGame = "";
        try {
          const response = JSON.parse(supplierOrder?.responsePayload || "{}");
          supplierGame = response?.order?.game || response?.game || "";
        } catch {}
        const statusResult = await supplierManager.checkOrderStatus(
          fulfilment.supplier as any,
          fulfilment.supplierOrderId,
          supplierOrder?.referenceCode,
          supplierGame
        );

        if (statusResult.isDelivered) {
          await fulfilmentService.markFulfilmentDelivered(fulfilment.id);
          updated++;
        } else if (statusResult.isFailed) {
          await prisma.fulfilment.update({
            where: { id: fulfilment.id },
            data: {
              status: FulfilmentStatus.FAILED,
              lastError: statusResult.errorMessage || "Supplier reported failure",
            },
          });

          await orderService.transitionStatus(
            fulfilment.orderId,
            OrderStatus.FAILED,
            statusResult.errorMessage || "Supplier reported delivery failure"
          );
          updated++;
        }
      } catch (err: any) {
        logger.error("Error reconciling supplier fulfilment", {
          fulfilmentId: fulfilment.id,
          error: err.message,
        });
      }
    }

    return {
      checked: undispatchedOrders.length + queuedFulfilments.length + pendingFulfilments.length,
      updated,
    };
  }
}

export const reconciliationService = new ReconciliationService();
