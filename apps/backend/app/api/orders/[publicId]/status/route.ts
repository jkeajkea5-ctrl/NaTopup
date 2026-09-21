import { NextResponse } from "next/server";
import { OrderStatus, PaymentStatus } from "@topup/shared";
import { prisma, safeDbQuery } from "@/lib/prisma";
import { inMemoryOrders, orderService } from "@/services/OrderService";
import { khqrClient } from "@/payments/khqr/client";
import { fulfilmentService } from "@/services/FulfilmentService";
import { logger } from "@/lib/logger";

const lastCheckMap = new Map<string, number>();

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: { publicId: string } }
) {
  try {
    const { publicId } = params;

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
            orderReference: publicId,
            transactionId: order.payment?.providerTransactionId,
          });

          if (verifyResult.paid) {
            logger.info("Payment confirmed via Check Transaction V2 polling", {
              publicOrderId: publicId,
              transactionId: verifyResult.transactionId,
              amount: verifyResult.paidAmount,
            });

            // 1. Update Payment record
            if (!String(order.id).startsWith("mem_")) {
              await safeDbQuery(
                () =>
                  prisma.payment.updateMany({
                    where: { orderId: order.id },
                    data: {
                      status: PaymentStatus.PAID,
                      providerTransactionId: verifyResult.transactionId || `TXN-${Date.now()}`,
                      paidAt: new Date(),
                      verifiedAt: new Date(),
                    },
                  }),
                null,
                1000
              );
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

            // 3. Trigger fulfilment asynchronously
            setImmediate(() => {
              fulfilmentService.processFulfilment(order.id).catch((err) => {
                logger.error("Error during asynchronous fulfilment after polling confirmation", {
                  orderId: publicId,
                  error: err.message,
                });
              });
            });
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
