import { NextResponse } from "next/server";
import { CreateOrderRequestSchema } from "@topup/shared";
import { checkRateLimit } from "../../../lib/rateLimit";
import {
  getCheckoutIdempotencyKey,
  getClientIp,
  hashActiveCheckoutKey,
  hashCheckoutRequest,
  hashPlayerRateLimitKey,
  rateLimitHeaders,
} from "../../../lib/requestSecurity";
import { orderService } from "../../../services/OrderService";
import { verifyTurnstileToken } from "../../../lib/turnstile";
import { getMaintenanceMode } from "../../../lib/maintenanceSettings";

export async function POST(request: Request) {
  try {
    if (await getMaintenanceMode()) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "MAINTENANCE_MODE",
            message: "The store is temporarily under maintenance. Please try again shortly.",
          },
        },
        { status: 503, headers: { "Retry-After": "300" } }
      );
    }

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

    const playerLimit = await checkRateLimit(
      `order-player:${hashPlayerRateLimitKey(parsed.data.gameSlug, parsed.data.playerData)}`,
      { windowMs: 15 * 60_000, maxRequests: 6 }
    );
    if (!playerLimit.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "PLAYER_ORDER_LIMIT_REACHED",
            message: playerLimit.unavailable
              ? "Order security check is temporarily unavailable. Please try again."
              : "Too many checkout attempts for this player account. Please wait before trying again.",
          },
        },
        { status: playerLimit.unavailable ? 503 : 429, headers: rateLimitHeaders(playerLimit) }
      );
    }

    const turnstile = await verifyTurnstileToken(body?.turnstileToken, ip);
    if (!turnstile.success) {
      const unavailable = turnstile.reason === "not-configured" || turnstile.reason === "provider-error";
      return NextResponse.json(
        {
          success: false,
          error: {
            code: unavailable ? "SECURITY_CHECK_UNAVAILABLE" : "SECURITY_CHECK_FAILED",
            message: unavailable
              ? "The checkout security check is temporarily unavailable. Please try again."
              : "Please complete the security check and try again.",
          },
        },
        { status: unavailable ? 503 : 403 }
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
      activeCheckoutKey: hashActiveCheckoutKey(parsed.data),
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
    const activeCheckoutExists = String(err?.message || "").startsWith("An unpaid checkout already exists");
    return NextResponse.json(
      {
        success: false,
        error: {
          code: activeCheckoutExists ? "ACTIVE_CHECKOUT_EXISTS" : "ORDER_CREATION_FAILED",
          message: activeCheckoutExists
            ? err.message
            : "The order could not be created. Please check the details and try again.",
        },
      },
      { status: activeCheckoutExists ? 409 : 400 }
    );
  }
}
