import { NextResponse } from "next/server";
import { CreateOrderRequestSchema } from "@topup/shared";
import { checkRateLimit } from "../../../lib/rateLimit";
import { orderService } from "../../../services/OrderService";

export async function POST(request: Request) {
  try {
    const ip = request.headers.get("x-forwarded-for") || "127.0.0.1";
    const limit = checkRateLimit(`order-create-${ip}`, { windowMs: 60000, maxRequests: 20 });
    if (!limit.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "RATE_LIMIT_EXCEEDED",
            message: "Too many orders created. Please slow down.",
          },
        },
        { status: 429 }
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
