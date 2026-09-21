import { NextResponse } from "next/server";
import { webhookService } from "../../../../services/WebhookService";

export async function POST(request: Request) {
  try {
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
