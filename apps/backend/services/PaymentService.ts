import { OrderStatus, PaymentStatus } from "@topup/shared";
import { config } from "../lib/config";
import { logger } from "../lib/logger";
import {
  PLAYER_VERIFICATION_REUSE_WINDOW_MS,
  PLAYER_VERIFIED_ORDER_EVENT_REASON,
} from "../lib/playerVerification";
import { prisma, safeDbQuery } from "../lib/prisma";
import { khqrClient } from "../payments/khqr/client";
import { supplierManager } from "../suppliers/supplierManager";

export class PaymentService {
  /**
   * Generates or retrieves an existing valid KHQR payment session for an order.
   */
  async getOrCreatePayment(publicOrderId: string, paymentProvider: "ANJAKPAY" | "KHQRPAY_ABA_V2" = "KHQRPAY_ABA_V2") {
    let order: any = await safeDbQuery(
      () =>
        prisma.order.findUnique({
          where: { publicOrderId },
          include: {
            payment: true,
            game: true,
            events: {
              where: { reason: PLAYER_VERIFIED_ORDER_EVENT_REASON },
              orderBy: { createdAt: "desc" },
              take: 1,
              select: { createdAt: true },
            },
          },
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

    if (![OrderStatus.AWAITING_PAYMENT, OrderStatus.PAYMENT_VERIFYING].includes(order.status) ||
        order.payment?.status === PaymentStatus.PAID) {
      throw new Error("This order can no longer accept a payment. Please check its status or start a new checkout.");
    }

    // A provider session may still settle after its QR is dismissed or expires.
    // Keep its reference intact so callbacks and reconciliation can recover it.
    if (order.payment && (order.payment.provider !== paymentProvider ||
        order.payment.status !== PaymentStatus.PENDING || order.payment.qrExpiresAt <= new Date())) {
      throw new Error("This order already has a payment session. Please use that session or start a new checkout.");
    }

    const verificationTime = order.events?.[0]?.createdAt;
    const hasFreshVerification =
      verificationTime instanceof Date &&
      verificationTime.getTime() >= Date.now() - PLAYER_VERIFICATION_REUSE_WINDOW_MS;
    if (!hasFreshVerification) {
      // Old orders and orders without the durable verification event are
      // checked again. New checkouts reuse only the verification performed
      // during the preceding order-creation request.
      await supplierManager.requireVerifiedPlayer(order.game.slug, JSON.parse(order.playerData || "{}"));
    }

    const now = new Date();

    // If active unexpired payment exists, return it
    if (order.payment && order.payment.provider === paymentProvider && order.payment.status === PaymentStatus.PENDING && order.payment.qrExpiresAt > now) {
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
      const txId = order.payment.providerTransactionId || order.publicOrderId;
      return {
        paymentId: order.payment.id,
        orderId: order.id,
        publicOrderId: order.publicOrderId,
        qrString: order.payment.qrPayload,
        qrImageUrl:
          order.payment.qrImageUrl ||
          (order.payment.provider === "ANJAKPAY" ? `${config.khqrcc.baseUrl}/api/khqrcc/qr/${txId}` : undefined),
        checkoutUrl:
          order.payment.checkoutUrl ||
          khqrClient.getCheckoutUrl(txId, order.payment.amount, order.payment.provider),
        merchantName: order.payment.merchantName || undefined,
        abaDeepLink: order.payment.abaDeepLink || undefined,
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
      provider: paymentProvider,
    });

    // Persist the provider session. If persistence fails, do not return a QR
    // that the application would be unable to reconcile later.
    const payment = await safeDbQuery(
      () =>
        prisma.payment.create({
            data: {
              orderId: order.id,
              provider: paymentProvider,
              providerReference: order.publicOrderId,
              providerPaymentId: khqrResult.orderReference,
              providerTransactionId: khqrResult.orderReference,
              amount: order.total,
              amountKhr: order.totalKhr,
              currency: "USD",
              status: PaymentStatus.PENDING,
              verifiedAt: null,
              qrPayload: khqrResult.qrString,
              qrImageUrl: khqrResult.qrImageUrl,
              checkoutUrl: khqrResult.checkoutUrl,
              merchantName: khqrResult.merchantName,
              abaDeepLink: khqrResult.abaDeepLink,
              md5Hash: khqrResult.md5,
              qrExpiresAt: khqrResult.expiresAt,
            },
        }).catch(async (error: any) => {
          if (error?.code !== "P2002") throw error;
          // Concurrent initialization must never reset a payment another
          // request saved (and which a callback may already have marked paid).
          return prisma.payment.findUnique({ where: { orderId: order.id } });
        }),
      null,
      5000
    );

    if (!payment) {
      throw new Error("Unable to save the payment session. Please try again.");
    }

    if (payment.status !== PaymentStatus.PENDING || payment.provider !== paymentProvider ||
        payment.qrExpiresAt <= new Date()) {
      throw new Error("The payment session changed. Please check the order status before trying again.");
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
      qrImageUrl: payment.qrImageUrl || undefined,
      checkoutUrl: payment.checkoutUrl || undefined,
      merchantName: payment.merchantName || undefined,
      abaDeepLink: payment.abaDeepLink || undefined,
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
