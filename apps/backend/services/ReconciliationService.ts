import { FulfilmentStatus, OrderStatus, PaymentStatus } from "@topup/shared";
import { config } from "../lib/config";
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
    const retryBefore = new Date(now.getTime() - config.paymentPolling.intervalSeconds * 1000);
    const recoveryCutoff = new Date(now.getTime() - config.paymentPolling.maxAgeMinutes * 60 * 1000);
    const pendingPayments = await prisma.payment.findMany({
      where: {
        status: { in: [PaymentStatus.PENDING, PaymentStatus.VERIFYING, PaymentStatus.EXPIRED] },
        createdAt: { gte: recoveryCutoff },
        OR: [{ verifiedAt: null }, { verifiedAt: { lte: retryBefore } }],
      },
      include: { order: true },
      orderBy: { createdAt: "asc" },
      take: config.paymentPolling.limit,
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
          const amountMatches =
            verifyResult.paidAmount === undefined ||
            Math.abs(verifyResult.paidAmount - payment.amount) <= 0.01;
          const currencyMatches =
            !verifyResult.currency ||
            verifyResult.currency.trim().toUpperCase() === payment.currency.trim().toUpperCase();
          if (!amountMatches || !currencyMatches) {
            logger.error("Reconciliation rejected mismatched payment details", {
              paymentId: payment.id,
              orderId: payment.order.publicOrderId,
              metadata: {
                expectedAmount: payment.amount,
                paidAmount: verifyResult.paidAmount,
                expectedCurrency: payment.currency,
                paidCurrency: verifyResult.currency,
              },
            });
            await prisma.payment.update({
              where: { id: payment.id },
              data: { verifiedAt: now },
            });
            continue;
          }

          const claimed = await prisma.payment.updateMany({
            where: { id: payment.id, status: { not: PaymentStatus.PAID } },
            data: {
              status: PaymentStatus.PAID,
              providerTransactionId: verifyResult.transactionId || payment.order.publicOrderId,
              paidAt: new Date(),
              verifiedAt: new Date(),
            },
          });
          if (claimed.count !== 1) continue;

          await orderService.transitionStatus(
            payment.order.id,
            OrderStatus.PAID,
            "Reconciliation confirmed payment via provider check"
          );

          await fulfilmentService.processFulfilment(payment.order.id);
          resolved++;
        } else if (now > payment.qrExpiresAt && payment.status !== PaymentStatus.EXPIRED) {
          // Payment expired
          await prisma.payment.update({
            where: { id: payment.id },
            data: { status: PaymentStatus.EXPIRED, verifiedAt: now },
          });

          await orderService.transitionStatus(
            payment.order.id,
            OrderStatus.EXPIRED,
            "Payment session expired"
          );
        } else {
          await prisma.payment.update({
            where: { id: payment.id },
            data: { verifiedAt: now },
          });
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
