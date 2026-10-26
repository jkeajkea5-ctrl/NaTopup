import { NextResponse } from "next/server";
import { getPaymentProviderSettings } from "../../../lib/paymentProviderSettings";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const providers = await getPaymentProviderSettings();
    return NextResponse.json({
      success: true,
      data: providers
        .filter((provider) => provider.enabled && provider.configured)
        .map(({ id, displayName, description }) => ({ id, displayName, description })),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json(
      { success: false, error: { code: "PAYMENT_OPTIONS_UNAVAILABLE", message: "Payment options are temporarily unavailable." } },
      { status: 503 }
    );
  }
}
