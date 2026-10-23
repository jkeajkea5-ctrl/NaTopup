import { NextResponse } from "next/server";
import { paymentService } from "@/services/PaymentService";

export async function POST(
  request: Request,
  { params }: { params: { publicId: string } }
) {
  try {
    const { publicId } = params;
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
