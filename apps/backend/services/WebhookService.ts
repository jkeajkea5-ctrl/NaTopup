import { FulfilmentStatus, OrderStatus, PaymentStatus, SupplierCode, SupplierOrderStatus } from "@topup/shared";
import { config } from "../lib/config";
import { logger } from "../lib/logger";
import { prisma } from "../lib/prisma";
import { sha256, verifyHmacSha256 } from "../lib/security";
import { khqrClient } from "../payments/khqr/client";
import { supplierManager } from "../suppliers/supplierManager";
import { fulfilmentService } from "./FulfilmentService";
import { orderService } from "./OrderService";

export function verifyVizoWebhookSignature(rawBody: string, signature: string | null | undefined, apiKey: string): boolean {
  const digest = signature?.replace(/^sha256=/i, "") || "";
  return !!apiKey && verifyHmacSha256(rawBody, digest, apiKey);
}

export function extractSupplierCallback(payload: any) {
  const data = payload?.data && typeof payload.data === "object" ? payload.data : payload || {};
  return {
    data,
    supplierOrderId: String(
      data.transaction_id || data.supplierOrderId || data.order_id || payload?.transaction_id || payload?.order_id || ""
    ),
    referenceCode: String(
      data.refOrder || data.ref_order || data.custom_id || data.remark ||
      payload?.refOrder || payload?.ref_order || payload?.custom_id || payload?.remark || ""
    ),
  };
}

export function inferG2BulkGameCode(...values: unknown[]): string {
  const text = values.filter(Boolean).join(" ").toLowerCase();
  if (text.includes("mlbb_exclusive") || text.includes("mobile legends philippines") || text.includes("mlbb exclusive")) return "mlbb_exclusive";
  if (text.includes("mlbb_global") || text.includes("mobile legends indonesia") || text.includes("mlbb global")) return "mlbb_global";
  if (text.includes("mlbb") || text.includes("mobile legends")) return "mlbb";
  if (text.includes("pubgm") || text.includes("pubg")) return "pubgm";
  if (text.includes("valorant_kh") || text.includes("valorant kh")) return "valorant_kh";
  if (text.includes("valorant_sg") || text.includes("valorant sg")) return "valorant_sg";
  if (text.includes("honor of kings") || text.includes("g2b_hok") || text.includes(" hok")) return "hok";
  if (text.includes("free fire") || text.includes("free_fire")) return "free_fire";
  return "";
}

export function paymentCurrencyMatches(callbackCurrency: unknown, expectedCurrency: string): boolean {
  if (callbackCurrency === undefined || callbackCurrency === null || callbackCurrency === "") return true;
  return String(callbackCurrency).trim().toUpperCase() === expectedCurrency.trim().toUpperCase();
}

export class WebhookService {
  /**
   * Handles incoming KHQR payment webhook idempotently.
   */
  async handleKhqrWebhook(
    rawBody: string,
    signature: string | null | undefined
  ): Promise<{ success: boolean; message: string; statusCode: number }> {
    const eventHash = sha256(rawBody);

    // 1. Signature Verification
    const isSignatureValid = khqrClient.verifyWebhook(rawBody, signature);
    if (!isSignatureValid) {
      logger.warn("KHQR webhook rejected: Invalid signature", { provider: "KHQR" });
      return { success: false, message: "Invalid webhook signature", statusCode: 401 };
    }

    let payload: any;
    try {
      payload = JSON.parse(rawBody);
    } catch (err) {
      return { success: false, message: "Invalid JSON payload", statusCode: 400 };
    }

    // 2. Event Deduplication via WebhookEvent table
    const existingEvent = await prisma.webhookEvent.findUnique({
      where: { eventHash },
    });

    if (existingEvent && existingEvent.processed) {
      logger.info("Duplicate webhook event ignored (already processed)", {
        provider: "KHQR",
        eventId: existingEvent.id,
      });
      return { success: true, message: "Webhook already processed", statusCode: 200 };
    }

    let eventRecord = existingEvent;
    if (!eventRecord) {
      try {
        eventRecord = await prisma.webhookEvent.create({
          data: {
            provider: "KHQR",
            eventId: payload.transactionId || payload.transaction_id || `KHQR-${Date.now()}`,
            eventHash,
            eventType: "PAYMENT_CONFIRMED",
            payload: rawBody,
            signatureValid: true,
            processed: false,
          },
        });
      } catch (err: any) {
        // Race condition: another concurrent webhook just inserted this eventHash!
        logger.info("Concurrent webhook event collision handled gracefully", {
          provider: "KHQR",
          eventHash,
        });
        return { success: true, message: "Duplicate webhook processed", statusCode: 200 };
      }
    }

    // 3. Extract & Match Payment
    // For AnajakPay / KHQRcc, transaction_id is the transaction_id we sent
    // while creating the QR, i.e. our public order ID.
    const orderReference =
      payload.orderReference || payload.order_reference || payload.orderId || payload.transaction_id;
    const transactionId = payload.transactionId || payload.transaction_id;
    const amount = Number.parseFloat(payload.amount);
    const currency = payload.currency;

    const providerStatus = String(payload.status || "SUCCESS").toUpperCase();
    if (providerStatus !== "SUCCESS" && providerStatus !== "PAID") {
      logger.warn("KHQR callback did not confirm payment", {
        orderReference,
        providerStatus,
      });
      if (eventRecord) {
        await prisma.webhookEvent.update({
          where: { id: eventRecord.id },
          data: { error: `Provider reported ${providerStatus}` },
        });
      }
      return { success: true, message: `Payment status is ${providerStatus}`, statusCode: 200 };
    }

    if (!orderReference) {
      if (eventRecord) {
        await prisma.webhookEvent.update({
          where: { id: eventRecord.id },
          data: { error: "Missing order reference" },
        });
      }
      return { success: false, message: "Missing order reference", statusCode: 400 };
    }

    const order = await prisma.order.findUnique({
      where: { publicOrderId: orderReference },
      include: { payment: true },
    });

    if (!order || !order.payment) {
      logger.error("Order or payment record not found for webhook", {
        orderReference,
        provider: "KHQR",
      });
      if (eventRecord) {
        await prisma.webhookEvent.update({
          where: { id: eventRecord.id },
          data: { error: "Order not found" },
        });
      }
      return { success: false, message: "Order not found", statusCode: 404 };
    }

    // 4. Verify Amount and Currency Match
    if (!Number.isFinite(amount) || Math.abs(order.payment.amount - amount) > 0.01) {
      const errorMsg = `Amount mismatch: expected ${order.payment.amount}, received ${amount}`;
      logger.error(errorMsg, { orderId: order.publicOrderId, provider: "KHQR" });
      if (eventRecord) {
        await prisma.webhookEvent.update({
          where: { id: eventRecord.id },
          data: { error: errorMsg },
        });
      }
      return { success: false, message: errorMsg, statusCode: 400 };
    }

    if (!paymentCurrencyMatches(currency, order.payment.currency)) {
      const errorMsg = `Currency mismatch: expected ${order.payment.currency}, received ${String(currency)}`;
      logger.error(errorMsg, { orderId: order.publicOrderId, provider: "KHQR" });
      if (eventRecord) {
        await prisma.webhookEvent.update({
          where: { id: eventRecord.id },
          data: { error: errorMsg },
        });
      }
      return { success: false, message: errorMsg, statusCode: 400 };
    }

    // 5. Idempotent Payment & Order Update
    const payment = order.payment;
    if (payment.status !== PaymentStatus.PAID) {
      const claimed = await prisma.payment.updateMany({
        where: { id: payment.id, status: { not: PaymentStatus.PAID } },
        data: {
          status: PaymentStatus.PAID,
          // KHQRcc uses the merchant transaction_id as its callback ID. Keep
          // the existing provider reference when it is already present.
          providerTransactionId: payment.providerTransactionId || transactionId,
          paidAt: new Date(),
          verifiedAt: new Date(),
        },
      });

      if (claimed.count === 1) {
        await orderService.transitionStatus(
          order.id,
          OrderStatus.PAID,
          `Payment confirmed via KHQR (Txn: ${transactionId})`
        );

        // Start fulfilment before returning. Detached callbacks are not reliable
        // in serverless runtimes and previously delayed dispatch until the cron.
        try {
          await fulfilmentService.processFulfilment(order.id);
        } catch (err: any) {
          logger.error("Error during fulfilment after payment", {
            orderId: order.publicOrderId,
            error: err.message,
          });
        }
      }
    }

    // 7. Mark Webhook as Processed
    if (eventRecord) {
      await prisma.webhookEvent.update({
        where: { id: eventRecord.id },
        data: {
          processed: true,
          processedAt: new Date(),
        },
      });
    }

    logger.info("KHQR webhook handled successfully", {
      orderId: order.publicOrderId,
      transactionId,
    });

    return { success: true, message: "Payment accepted and processed", statusCode: 200 };
  }

  /**
   * Handles supplier delivery status webhook.
   */
  async handleSupplierWebhook(
    supplier: "G2BULK" | "VIZO",
    rawBody: string,
    signature?: string | null
  ): Promise<{ success: boolean; message: string; statusCode: number }> {
    // Vizo signs the exact raw JSON body as `sha256=<HMAC>` using the API key.
    if (supplier === "VIZO") {
      if (!verifyVizoWebhookSignature(rawBody, signature, config.vizo.apiKey)) {
        logger.warn("Vizo webhook rejected: invalid signature", { provider: supplier });
        return { success: false, message: "Invalid webhook signature", statusCode: 401 };
      }
    }

    let payload: any;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return { success: false, message: "Invalid JSON", statusCode: 400 };
    }

    const eventHash = sha256(`${supplier}:${rawBody}`);
    const existing = await prisma.webhookEvent.findUnique({ where: { eventHash } });
    if (existing?.processed) {
      return { success: true, message: "Already processed", statusCode: 200 };
    }

    // Vizo nests order details under `data`; G2Bulk sends a flat payload and
    // returns our local reference in `remark`.
    const { data, supplierOrderId, referenceCode } = extractSupplierCallback(payload);

    const matches: any[] = [];
    if (supplierOrderId) matches.push({ supplierOrderId });
    if (referenceCode) matches.push({ referenceCode });
    if (!matches.length) {
      return { success: false, message: "Missing supplier order reference", statusCode: 400 };
    }

    const supplierOrder = await prisma.supplierOrder.findFirst({
      where: { supplier, OR: matches },
      include: { fulfilment: { include: { order: true } } },
    });
    if (!supplierOrder) {
      logger.warn("Supplier webhook did not match a stored supplier order", {
        provider: supplier,
        supplierOrderId: supplierOrderId || undefined,
        referenceCode: referenceCode || undefined,
      });
      return { success: false, message: "Supplier order not found", statusCode: 404 };
    }

    let status = String(data.status || payload.status || "").toUpperCase();
    if (payload.event === "order.completed") status = "COMPLETED";
    if (payload.event === "order.failed") status = "FAILED";

    // G2Bulk documents no webhook signature. Confirm its callback through the
    // authenticated order-status API before changing customer order state.
    if (supplier === "G2BULK") {
      let supplierGame = "";
      try {
        const originalResponse = JSON.parse(supplierOrder.responsePayload || "{}");
        const originalRequest = JSON.parse(supplierOrder.requestPayload || "{}");
        supplierGame = inferG2BulkGameCode(
          data?.game,
          data?.game_code,
          payload?.game,
          payload?.game_code,
          originalResponse?.order?.game,
          originalResponse?.game,
          originalRequest?.productId
        );
      } catch {}
      const storedSupplierOrderId = supplierOrder.supplierOrderId || "";
      const confirmedSupplierOrderId = /^\d+$/.test(storedSupplierOrderId)
        ? storedSupplierOrderId
        : supplierOrderId;
      const confirmed = await supplierManager.checkOrderStatus(
        SupplierCode.G2BULK,
        confirmedSupplierOrderId,
        supplierOrder.referenceCode,
        supplierGame
      );
      if (confirmed.isDelivered) status = "COMPLETED";
      else if (confirmed.isFailed) status = "FAILED";
      else {
        return { success: false, message: "Supplier status is not terminal", statusCode: 503 };
      }
    }

    let eventRecord = existing;
    if (!eventRecord) {
      try {
        eventRecord = await prisma.webhookEvent.create({
          data: {
            provider: supplier,
            eventId: supplierOrderId || `SUP-${Date.now()}`,
            eventHash,
            eventType: payload.event || "SUPPLIER_CALLBACK",
            payload: rawBody,
            signatureValid: supplier === "VIZO" || supplier === "G2BULK",
            processed: false,
          },
        });
      } catch {
        return { success: true, message: "Duplicate supplier webhook", statusCode: 200 };
      }
    }

    const delivered = ["COMPLETED", "SUCCESS", "DELIVERED"].includes(status);
    const failed = ["FAILED", "REJECTED", "CANCELLED", "CANCELED", "REFUNDED"].includes(status);
    if (!delivered && !failed) {
      return { success: false, message: `Unsupported supplier status: ${status || "missing"}`, statusCode: 400 };
    }

    await prisma.supplierOrder.update({
      where: { id: supplierOrder.id },
      data: {
        status: delivered ? SupplierOrderStatus.COMPLETED : SupplierOrderStatus.FAILED,
        supplierOrderId: supplierOrderId || supplierOrder.supplierOrderId || undefined,
        responsePayload: rawBody,
      },
    });

    if (delivered) {
      if (supplierOrderId && !supplierOrder.fulfilment.supplierOrderId) {
        await prisma.fulfilment.update({
          where: { id: supplierOrder.fulfilment.id },
          data: { supplierOrderId },
        });
      }
      await fulfilmentService.markFulfilmentDelivered(supplierOrder.fulfilment.id);
    } else {
      await prisma.fulfilment.update({
        where: { id: supplierOrder.fulfilment.id },
        data: {
          status: FulfilmentStatus.FAILED,
          lastError: data.message || payload.message || `Supplier reported ${status}`,
        },
      });
      // Payment was already collected, so supplier failure requires review or
      // refund instead of presenting the customer's paid order as unpaid.
      await orderService.transitionStatus(
        supplierOrder.fulfilment.orderId,
        OrderStatus.REVIEW_REQUIRED,
        data.message || payload.message || `Supplier reported ${status}`
      );
    }

    if (eventRecord) {
      await prisma.webhookEvent.update({
        where: { id: eventRecord.id },
        data: { processed: true, processedAt: new Date() },
      });
    }

    return { success: true, message: "Supplier webhook processed", statusCode: 200 };
  }
}

export const webhookService = new WebhookService();
