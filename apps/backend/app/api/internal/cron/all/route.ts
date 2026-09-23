import { NextResponse } from "next/server";
import { config } from "../../../../../lib/config";
import { verifyBearerToken } from "../../../../../lib/security";
import { reconciliationService } from "../../../../../services/ReconciliationService";
import { telegramAlertService } from "../../../../../services/TelegramAlertService";

async function runAllReconciliation(request: Request) {
  if (!verifyBearerToken(request.headers.get("authorization"), config.cronSecret)) {
    return NextResponse.json(
      { success: false, error: "Unauthorized cron access" },
      { status: 401 }
    );
  }

  try {
    // Run sequentially so a payment confirmed by ABA can be recovered and then
    // picked up by the same invocation if the first fulfilment attempt stopped.
    const payments = await reconciliationService.reconcilePendingPayments();
    const fulfilments = await reconciliationService.reconcilePendingFulfilments();
    const telegram = await telegramAlertService.retryPendingOrderAlerts();

    return NextResponse.json({
      success: true,
      data: { payments, fulfilments, telegram },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  return runAllReconciliation(request);
}

// Supported by both Vercel Cron and cron-job.org.
export async function GET(request: Request) {
  return runAllReconciliation(request);
}
