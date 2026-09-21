import { NextResponse } from "next/server";
import { webhookService } from "../../../../services/WebhookService";

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
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
