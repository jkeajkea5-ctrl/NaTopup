import { NextResponse } from "next/server";
import { paymentService } from "@/services/PaymentService";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rateLimit";
import { getClientIp, getOrderLookupToken, rateLimitHeaders, verifyOrderLookupToken } from "@/lib/requestSecurity";

export async function POST(
  request: Request,
  { params }: { params: { publicId: string } }
) {
  try {
    const { publicId } = params;
    const limit = await checkRateLimit(`payment-init:${getClientIp(request)}:${publicId}`, { windowMs: 60000, maxRequests: 6 });
    if (!limit.allowed) {
      return NextResponse.json(
        { success: false, error: { code: "RATE_LIMIT_EXCEEDED", message: "Too many payment attempts. Please wait." } },
        { status: limit.unavailable ? 503 : 429, headers: rateLimitHeaders(limit) }
      );
    }
    const access = await prisma.order.findUnique({
      where: { publicOrderId: publicId },
      select: { publicLookupToken: true },
    });
    if (!access || !verifyOrderLookupToken(getOrderLookupToken(request), access.publicLookupToken)) {
      return NextResponse.json(
        { success: false, error: { code: "ORDER_NOT_FOUND", message: "Order not found." } },
        { status: 404 }
      );
    }
    const body = await request.json().catch(() => ({}));
    if (body?.provider === "ANJAKPAY") {
      return NextResponse.json(
        { success: false, error: { code: "PAYMENT_METHOD_UNAVAILABLE", message: "ABA KHQR is not available yet. Please use ABA KHQR v2." } },
        { status: 400 }
      );
    }
    const provider = "KHQRPAY_ABA_V2";
    const payment = await paymentService.getOrCreatePayment(publicId, provider);

    return NextResponse.json({
      success: true,
      data: payment,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "PAYMENT_INIT_FAILED",
          message: err.message || "Failed to initialize payment",
        },
      },
      { status: 400 }
    );
  }
}
