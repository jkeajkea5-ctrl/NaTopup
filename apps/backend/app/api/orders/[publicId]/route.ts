import { NextResponse } from "next/server";
import { orderService } from "../../../../services/OrderService";
import { checkRateLimit } from "../../../../lib/rateLimit";
import { getClientIp, getOrderLookupToken, rateLimitHeaders } from "../../../../lib/requestSecurity";

export async function GET(
  request: Request,
  { params }: { params: { publicId: string } }
) {
  try {
    const { publicId } = params;
    const limit = await checkRateLimit(`order-detail:${getClientIp(request)}:${publicId}`, { windowMs: 60000, maxRequests: 20 });
    if (!limit.allowed) {
      return NextResponse.json(
        { success: false, error: { code: "RATE_LIMIT_EXCEEDED", message: "Too many order lookups. Please wait." } },
        { status: limit.unavailable ? 503 : 429, headers: rateLimitHeaders(limit) }
      );
    }
    const order = await orderService.getPublicOrder(publicId, getOrderLookupToken(request));

    if (!order) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "ORDER_NOT_FOUND",
            message: `Order ${publicId} not found.`,
          },
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: order,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: { code: "SERVER_ERROR", message: err.message },
      },
      { status: 500 }
    );
  }
}
