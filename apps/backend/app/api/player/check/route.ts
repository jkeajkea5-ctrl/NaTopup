import { NextResponse } from "next/server";
import { PlayerCheckRequestSchema } from "@topup/shared";
import { checkRateLimit } from "../../../../lib/rateLimit";
import { supplierManager } from "../../../../suppliers/supplierManager";

export async function POST(request: Request) {
  try {
    const ip = request.headers.get("x-forwarded-for") || "127.0.0.1";
    const limit = checkRateLimit(`player-check-${ip}`, { windowMs: 60000, maxRequests: 30 });
    if (!limit.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "RATE_LIMIT_EXCEEDED",
            message: "Too many player verification requests. Please wait a moment.",
          },
        },
        { status: 429 }
      );
    }

    const body = await request.json();
    const parsed = PlayerCheckRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: parsed.error.errors[0]?.message || "Invalid input",
          },
        },
        { status: 400 }
      );
    }

    const normalizedSlug = parsed.data.gameSlug === "free-fire-khsgmy" ? "free-fire" : parsed.data.gameSlug;
    const result = await supplierManager.checkPlayer(normalizedSlug, parsed.data.fields);

    // Never expose raw supplier response to customer; return sanitized DTO
    if (result.valid) {
      return NextResponse.json({
        success: true,
        data: {
          valid: true,
          playerName: result.playerName,
          message: "Account verified successfully",
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        valid: false,
        message: result.errorMessage || "មិនអាចពិនិត្យគណនីអ្នកលេងបានទេនៅពេលនេះ។ សូមព្យាយាមម្តងទៀត។",
      },
    });
  } catch (err: any) {
    console.error("Player check error:", err);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "CHECK_FAILED",
          message: err?.message || "មិនអាចពិនិត្យគណនីអ្នកលេងបានទេនៅពេលនេះ។ សូមព្យាយាមម្តងទៀត។",
        },
      },
      { status: 500 }
    );
  }
}
