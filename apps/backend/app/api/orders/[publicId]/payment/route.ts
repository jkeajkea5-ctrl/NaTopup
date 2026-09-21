import { NextResponse } from "next/server";
import { paymentService } from "@/services/PaymentService";

export async function POST(
  request: Request,
  { params }: { params: { publicId: string } }
) {
  try {
    const { publicId } = params;
    const payment = await paymentService.getOrCreatePayment(publicId);

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
