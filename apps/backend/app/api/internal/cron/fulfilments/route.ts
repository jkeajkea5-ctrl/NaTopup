import { NextResponse } from "next/server";
import { config } from "../../../../../lib/config";
import { verifyBearerToken } from "../../../../../lib/security";
import { reconciliationService } from "../../../../../services/ReconciliationService";

async function runFulfilmentReconciliation(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!verifyBearerToken(authHeader, config.cronSecret)) {
    return NextResponse.json(
      { success: false, error: "Unauthorized cron access" },
      { status: 401 }
    );
  }

  try {
    const result = await reconciliationService.reconcilePendingFulfilments();
    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return runFulfilmentReconciliation(request);
}

// Vercel Cron invokes routes with GET.
export async function GET(request: Request) {
  return runFulfilmentReconciliation(request);
}
