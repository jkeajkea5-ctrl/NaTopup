import { NextResponse } from "next/server";
import { config } from "../../../../../lib/config";
import { verifyBearerToken } from "../../../../../lib/security";
import { telegramAlertService } from "../../../../../services/TelegramAlertService";
import { supplierManager } from "../../../../../suppliers/supplierManager";

async function runBalanceCheck(request: Request) {
  if (!verifyBearerToken(request.headers.get("authorization"), config.cronSecret)) {
    return NextResponse.json({ success: false, error: "Unauthorized cron access" }, { status: 401 });
  }

  try {
    const balances = await supplierManager.getAllBalances();
    const threshold = config.telegram.lowBalanceThresholdUsd;
    const alerts = await Promise.all(
      balances
        .filter(
          (entry) =>
            entry.isHealthy &&
            entry.balance <= threshold &&
            (entry.supplier === "G2BULK" || entry.supplier === "VIZO")
        )
        .map((entry) =>
          telegramAlertService.notifyLowBalance(entry.supplier, entry.balance, entry.currency, threshold)
        )
    );
    return NextResponse.json({
      success: true,
      threshold,
      balances,
      alertsSent: alerts.filter(Boolean).length,
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return runBalanceCheck(request);
}

export async function GET(request: Request) {
  return runBalanceCheck(request);
}
