import { NextResponse } from "next/server";
import { CreateOrderRequestSchema } from "@topup/shared";
import { checkRateLimit } from "../../../lib/rateLimit";
import {
  getCheckoutIdempotencyKey,
  getClientIp,
  hashCheckoutRequest,
  rateLimitHeaders,
} from "../../../lib/requestSecurity";
import { orderService } from "../../../services/OrderService";

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    const minuteLimit = await checkRateLimit(`order-create:minute:${ip}`, { windowMs: 60000, maxRequests: 6 });
    if (!minuteLimit.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "RATE_LIMIT_EXCEEDED",
            message: minuteLimit.unavailable
              ? "Order security check is temporarily unavailable. Please try again."
              : "Too many orders created. Please slow down.",
          },
        },
        { status: minuteLimit.unavailable ? 503 : 429, headers: rateLimitHeaders(minuteLimit) }
      );
    }

    const hourLimit = await checkRateLimit(`order-create:hour:${ip}`, { windowMs: 3600000, maxRequests: 30 });
    if (!hourLimit.allowed) {
      return NextResponse.json(
        { success: false, error: { code: "RATE_LIMIT_EXCEEDED", message: "Order creation limit reached. Please try again later." } },
        { status: hourLimit.unavailable ? 503 : 429, headers: rateLimitHeaders(hourLimit) }
      );
    }

    const checkoutRequestId = getCheckoutIdempotencyKey(request);
    if (!checkoutRequestId) {
      return NextResponse.json(
        { success: false, error: { code: "IDEMPOTENCY_KEY_REQUIRED", message: "A valid checkout request key is required." } },
        { status: 400 }
      );
    }

    const body = await request.json();
    const parsed = CreateOrderRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: parsed.error.errors[0]?.message || "Invalid order parameters",
          },
        },
        { status: 400 }
      );
    }

    const order = await orderService.createOrder({
      gameSlug: parsed.data.gameSlug,
      productId: parsed.data.productId,
      playerData: parsed.data.playerData,
      currency: parsed.data.currency,
      clientIp: ip,
      customerEmail: parsed.data.customerEmail,
      customerPhone: parsed.data.customerPhone,
      checkoutRequestId,
      checkoutRequestHash: hashCheckoutRequest(parsed.data),
    });

    return NextResponse.json({
      success: true,
      data: {
        publicOrderId: order.publicOrderId,
        lookupToken: order.publicLookupToken,
        status: order.status,
        total: order.total,
        totalKhr: order.totalKhr,
        currency: order.currency,
        createdAt: order.createdAt,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "ORDER_CREATION_FAILED",
          message: err.message || "Failed to create order",
        },
      },
      { status: 400 }
    );
  }
}
