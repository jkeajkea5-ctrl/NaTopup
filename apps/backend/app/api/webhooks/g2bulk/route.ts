import { NextResponse } from "next/server";
import { webhookService } from "../../../../services/WebhookService";
import { checkRateLimit } from "../../../../lib/rateLimit";
import { getClientIp, rateLimitHeaders } from "../../../../lib/requestSecurity";

export async function POST(request: Request) {
  try {
    const limit = await checkRateLimit(`g2bulk-webhook:${getClientIp(request)}`, { windowMs: 60000, maxRequests: 120 });
    if (!limit.allowed) {
      return NextResponse.json(
        { success: false, error: limit.unavailable ? "Webhook security check unavailable" : "Too many webhook requests" },
        { status: limit.unavailable ? 503 : 429, headers: rateLimitHeaders(limit) }
      );
    }
    const rawBody = await request.text();
    const result = await webhookService.handleSupplierWebhook("G2BULK", rawBody);
    return NextResponse.json(
      { success: result.success, message: result.message },
      { status: result.statusCode }
    );
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
