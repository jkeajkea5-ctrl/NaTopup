import { NextResponse } from "next/server";
import { config } from "../../../../../lib/config";
import { webhookService } from "../../../../../services/WebhookService";

function customerOrderPage(orderId: string | null) {
  const destination = new URL("/check-order", config.frontendUrl);
  if (orderId) destination.searchParams.set("orderId", orderId);
  return NextResponse.redirect(destination, 303);
}

// Browsers are returned here after the managed checkout. The check-order page
// polls our backend, which verifies the transaction directly with KHQRcc.
export async function GET(request: Request) {
  const url = new URL(request.url);
  return customerOrderPage(url.searchParams.get("orderId") || url.searchParams.get("transaction_id"));
}

// KHQRcc can also POST its signed success notification to success_url. Process
// it exactly like a webhook before acknowledging it; never mark a payment paid
// based solely on the browser redirect.
export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const signature =
      request.headers.get("x-khqr-signature") ||
      request.headers.get("x-signature") ||
      request.headers.get("authorization");
    const result = await webhookService.handleKhqrWebhook(rawBody, signature);

    return NextResponse.json(
      { success: result.success, message: result.message },
      { status: result.statusCode }
    );
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { message: "Unable to process payment callback" } },
      { status: 500 }
    );
  }
}
