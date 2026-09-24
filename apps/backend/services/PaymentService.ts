import { PaymentStatus } from "@topup/shared";
import { config } from "../lib/config";
import { logger } from "../lib/logger";
import { prisma, safeDbQuery } from "../lib/prisma";
import { khqrClient } from "../payments/khqr/client";
import { supplierManager } from "../suppliers/supplierManager";

export class PaymentService {
  /**
   * Generates or retrieves an existing valid KHQR payment session for an order.
   */
  async getOrCreatePayment(publicOrderId: string) {
    let order: any = await safeDbQuery(
      () =>
        prisma.order.findUnique({
          where: { publicOrderId },
          include: { payment: true, game: true },
        }),
      null,
      5000
    );

    if (!order) {
      throw new Error(`Order ${publicOrderId} not found`);
    }

    // A payment must always be recoverable by the webhook, reconciliation job,
    // and customer status page. Never accept funds for an in-memory order.
    if (String(order.id).startsWith("mem_")) {
      throw new Error("The order database is unavailable. Please try again shortly.");
    }

    await supplierManager.requireVerifiedPlayer(order.game.slug, JSON.parse(order.playerData || "{}"));

    const now = new Date();

    // If active unexpired payment exists, return it
    if (order.payment && order.payment.status === PaymentStatus.PENDING && order.payment.qrExpiresAt > now) {
      if (!order.payment.providerTransactionId) {
        const repairedPayment = await safeDbQuery(
          () =>
            prisma.payment.update({
              where: { id: order.payment.id },
              data: { providerTransactionId: order.publicOrderId },
            }),
          null,
          5000
        );
        if (!repairedPayment) {
          throw new Error("Unable to restore the payment session. Please try again.");
        }
        order.payment = repairedPayment;
      }
      const remainingSeconds = Math.max(0, Math.floor((order.payment.qrExpiresAt.getTime() - now.getTime()) / 1000));
      const txId = order.publicOrderId;
      return {
        paymentId: order.payment.id,
        orderId: order.id,
        publicOrderId: order.publicOrderId,
        qrString: order.payment.qrPayload,
        qrImageUrl:
          order.payment.qrImageUrl ||
          `${config.khqrcc.baseUrl}/api/khqrcc/qr/${txId}`,
        checkoutUrl: khqrClient.getCheckoutUrl(txId, order.payment.amount),
        md5: order.payment.md5Hash || "",
        amount: order.payment.amount,
        currency: order.payment.currency,
        amountKhr: order.payment.amountKhr,
        expiresAt: order.payment.qrExpiresAt.toISOString(),
        remainingSeconds,
        status: order.payment.status,
      };
    }

    // Otherwise generate dynamic KHQR
    const khqrResult = await khqrClient.generatePayment({
      merchantId: config.khqr.merchantId,
      merchantName: config.khqr.merchantName,
      terminalId: config.khqr.terminalId,
      amount: order.total,
      currency: "USD",
      orderReference: order.publicOrderId,
      expirationMinutes: config.business.paymentExpiryMinutes,
    });

    // Persist the provider session. If persistence fails, do not return a QR
    // that the application would be unable to reconcile later.
    const payment = await safeDbQuery(
      () =>
        prisma.payment.upsert({
            where: { orderId: order.id },
            update: {
              status: PaymentStatus.PENDING,
              // Store an explicit null for MongoDB. A missing optional field
              // does not match `verifiedAt: null` during reconciliation.
              verifiedAt: null,
              qrPayload: khqrResult.qrString,
              md5Hash: khqrResult.md5,
              qrExpiresAt: khqrResult.expiresAt,
              amount: order.total,
              amountKhr: order.totalKhr,
            },
            create: {
              orderId: order.id,
              provider: "KHQR",
              providerReference: order.publicOrderId,
              // MongoDB unique indexes allow only one null value. The AnajakPay
              // transaction ID is our merchant order ID until payment confirms.
              providerTransactionId: order.publicOrderId,
              amount: order.total,
              amountKhr: order.totalKhr,
              currency: "USD",
              status: PaymentStatus.PENDING,
              verifiedAt: null,
              qrPayload: khqrResult.qrString,
              md5Hash: khqrResult.md5,
              qrExpiresAt: khqrResult.expiresAt,
            },
        }),
      null,
      5000
    );

    if (!payment) {
      throw new Error("Unable to save the payment session. Please try again.");
    }

    logger.info("Generated new KHQR payment session", {
      orderId: order.publicOrderId,
      paymentId: payment.id,
      amount: order.total,
    });

    const remainingSeconds = Math.max(0, Math.floor((payment.qrExpiresAt.getTime() - now.getTime()) / 1000));

    return {
      paymentId: payment.id,
      orderId: order.id,
      publicOrderId: order.publicOrderId,
      qrString: payment.qrPayload,
      qrImageUrl: khqrResult.qrImageUrl,
      checkoutUrl: khqrResult.checkoutUrl,
      md5: payment.md5Hash || "",
      amount: payment.amount,
      currency: payment.currency,
      amountKhr: payment.amountKhr,
      expiresAt: payment.qrExpiresAt.toISOString(),
      remainingSeconds,
      status: payment.status,
    };
  }
}

export const paymentService = new PaymentService();
