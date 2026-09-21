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
        status: PaymentStatus.PENDING,
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
    const pendingFulfilments = await prisma.fulfilment.findMany({
      where: {
        status: FulfilmentStatus.PROCESSING,
        supplierOrderId: { not: null },
      },
      include: { order: true },
    });

    let updated = 0;
    for (const fulfilment of pendingFulfilments) {
      if (!fulfilment.supplierOrderId) continue;

      try {
        const statusResult = await supplierManager.checkOrderStatus(
          fulfilment.supplier as any,
          fulfilment.supplierOrderId
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

    return { checked: pendingFulfilments.length, updated };
  }
}

export const reconciliationService = new ReconciliationService();
