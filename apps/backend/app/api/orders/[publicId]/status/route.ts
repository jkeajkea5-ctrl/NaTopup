import { NextResponse } from "next/server";
import { OrderStatus, PaymentStatus } from "@topup/shared";
import { prisma, safeDbQuery } from "@/lib/prisma";
import { inMemoryOrders, orderService } from "@/services/OrderService";
import { khqrClient, verifiedPaymentMatches } from "@/payments/khqr/client";
import { fulfilmentService } from "@/services/FulfilmentService";
import { logger } from "@/lib/logger";
import { checkRateLimit } from "@/lib/rateLimit";
import { getClientIp, getOrderLookupToken, rateLimitHeaders, verifyOrderLookupToken } from "@/lib/requestSecurity";

const lastCheckMap = new Map<string, number>();

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: { publicId: string } }
) {
  try {
    const { publicId } = params;

    const limit = await checkRateLimit(`order-status:${getClientIp(request)}:${publicId}`, { windowMs: 60000, maxRequests: 30 });
    if (!limit.allowed) {
      return NextResponse.json(
        { success: false, error: { message: "Too many status checks. Please wait." } },
        { status: limit.unavailable ? 503 : 429, headers: rateLimitHeaders(limit) }
      );
    }

    let order: any = await safeDbQuery(
      () =>
        prisma.order.findUnique({
          where: { publicOrderId: publicId },
          include: {
            payment: {
              select: {
                id: true,
                status: true,
                qrExpiresAt: true,
                paidAt: true,
                providerTransactionId: true,
                md5Hash: true,
                amount: true,
                currency: true,
              },
            },
            fulfilment: {
              select: {
                status: true,
                completedAt: true,
              },
            },
          },
        }),
      null,
      1000
    );

    if (!order) {
      order = inMemoryOrders.get(publicId);
    }

    if (!order) {
      return NextResponse.json(
        { success: false, error: { message: "Order not found" } },
        { status: 404 }
      );
    }

    if (!verifyOrderLookupToken(getOrderLookupToken(request), order.publicLookupToken || "")) {
      return NextResponse.json(
        { success: false, error: { message: "Order not found" } },
        { status: 404 }
      );
    }

    const now = new Date();

    // If order is awaiting payment, poll Check Transaction V2 no more than
    // once every 3 seconds, as recommended by KHQRcc.
    if (
      order.status === OrderStatus.AWAITING_PAYMENT ||
      order.status === OrderStatus.PAYMENT_VERIFYING
    ) {
      const lastCheck = lastCheckMap.get(publicId) || 0;
      if (Date.now() - lastCheck >= 3000) {
        lastCheckMap.set(publicId, Date.now());

        try {
          const verifyResult = await khqrClient.verifyPayment({
            md5: order.payment?.md5Hash || undefined,
            orderReference: publicId,
            transactionId: order.payment?.providerTransactionId,
            provider: order.payment?.provider,
          });

          if (
            order.payment &&
            verifiedPaymentMatches(
              verifyResult,
              order.payment.amount,
              order.payment.currency,
              order.payment.providerTransactionId
            )
          ) {
            logger.info("Payment confirmed via Check Transaction V2 polling", {
              publicOrderId: publicId,
              transactionId: verifyResult.transactionId,
              amount: verifyResult.paidAmount,
            });

            // 1. Update Payment record
            if (!String(order.id).startsWith("mem_")) {
              const claimed = await safeDbQuery(
                () =>
                  prisma.payment.updateMany({
                    where: { orderId: order.id, status: { not: PaymentStatus.PAID } },
                    data: {
                      status: PaymentStatus.PAID,
                      providerTransactionId: verifyResult.transactionId || publicId,
                      paidAt: new Date(),
                      verifiedAt: new Date(),
                    },
                  }),
                null,
                1000
              );
              if (!claimed || claimed.count !== 1) {
                return NextResponse.json({
                  success: true,
                  data: {
                    publicOrderId: order.publicOrderId,
                    status: order.status,
                    customerStatusText: "Verifying Payment...",
                    isTerminal: false,
                    paymentStatus: order.payment.status,
                  },
                });
              }
            }

            // 2. Transition Order Status
            await orderService.transitionStatus(
              order.id,
              OrderStatus.PAID,
              `Payment confirmed via Check Transaction V2 (Txn: ${verifyResult.transactionId})`
            );

            // Update in-memory state
            order.status = OrderStatus.PAID;
            order.paidAt = new Date();
            if (order.payment) {
              order.payment.status = PaymentStatus.PAID;
              order.payment.paidAt = new Date();
            }

            // 3. Start fulfilment before the serverless request exits.
            try {
              await fulfilmentService.processFulfilment(order.id);
            } catch (err: any) {
              logger.error("Error during fulfilment after polling confirmation", {
                orderId: publicId,
                error: err.message,
              });
            }
          }
        } catch (err: any) {
          logger.warn("Non-fatal error polling Check Transaction V2", {
            publicOrderId: publicId,
            error: err.message,
          });
        }
      }
    }

    const remainingSeconds = order.payment?.qrExpiresAt
      ? Math.max(0, Math.floor((order.payment.qrExpiresAt.getTime() - now.getTime()) / 1000))
      : 0;

    // Map technical status to friendly customer status
    let customerStatusText = "Waiting for Payment";
    let isTerminal = false;

    switch (order.status) {
      case OrderStatus.AWAITING_PAYMENT:
        customerStatusText = "Waiting for Payment";
        break;
      case OrderStatus.PAYMENT_VERIFYING:
        customerStatusText = "Verifying Payment...";
        break;
      case OrderStatus.PAID:
      case OrderStatus.FULFILMENT_QUEUED:
        customerStatusText = "Payment Confirmed";
        break;
      case OrderStatus.PROCESSING:
        customerStatusText = "Processing Top-Up";
        break;
      case OrderStatus.DELIVERED:
        customerStatusText = "Delivered";
        isTerminal = true;
        break;
      case OrderStatus.FAILED:
        customerStatusText = "Order Failed";
        isTerminal = true;
        break;
      case OrderStatus.EXPIRED:
        customerStatusText = "Payment Expired";
        isTerminal = true;
        break;
      case OrderStatus.REVIEW_REQUIRED:
        customerStatusText = "We Need to Review This Order";
        break;
      case OrderStatus.REFUNDED:
        customerStatusText = "Refunded";
        isTerminal = true;
        break;
      case OrderStatus.CANCELLED:
        customerStatusText = "Cancelled";
        isTerminal = true;
        break;
    }

    return NextResponse.json({
      success: true,
      data: {
        publicOrderId: order.publicOrderId,
        status: order.status,
        customerStatusText,
        isTerminal,
        paymentStatus: order.payment?.status || "PENDING",
        remainingSeconds,
        paidAt: order.paidAt,
        completedAt: order.completedAt,
        timeline: [
          {
            step: "CREATED",
            title: "Order Created",
            completed: true,
            time: order.createdAt,
          },
          {
            step: "PAYMENT",
            title: "Payment Received",
            completed:
              order.status === OrderStatus.PAID ||
              order.status === OrderStatus.FULFILMENT_QUEUED ||
              order.status === OrderStatus.PROCESSING ||
              order.status === OrderStatus.DELIVERED,
            time: order.paidAt,
          },
          {
            step: "PROCESSING",
            title: "Processing Delivery",
            completed:
              order.status === OrderStatus.PROCESSING ||
              order.status === OrderStatus.DELIVERED,
            active: order.status === OrderStatus.PROCESSING,
          },
          {
            step: "DELIVERED",
            title: "Delivered to Account",
            completed: order.status === OrderStatus.DELIVERED,
            time: order.completedAt,
          },
        ],
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { message: err.message } },
      { status: 500 }
    );
  }
}
