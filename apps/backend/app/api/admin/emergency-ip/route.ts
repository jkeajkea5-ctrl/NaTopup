import crypto from "node:crypto";
import net from "node:net";
import { NextResponse } from "next/server";
import { getClientIp } from "../../../../lib/adminAuth";
import { prisma } from "../../../../lib/prisma";

export const dynamic = "force-dynamic";

function secretMatches(candidate: string | null) {
  const expected = process.env.ADMIN_EMERGENCY_IP_SECRET || "";
  if (!candidate || expected.length < 32 || candidate.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(candidate), Buffer.from(expected));
}

function notFound() {
  return new NextResponse("404 page not found", {
    status: 404,
    headers: { "Cache-Control": "no-store", "Content-Type": "text/plain; charset=utf-8" },
  });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  if (!secretMatches(url.searchParams.get("secret"))) return notFound();

  const ipAddress = getClientIp(request);
  if (!net.isIP(ipAddress)) return notFound();

  try {
    await prisma.adminIpAllowlist.upsert({
      where: { ipAddress },
      update: { isActive: true, label: "Emergency secret URL", lastUsedAt: new Date() },
      create: { ipAddress, isActive: true, label: "Emergency secret URL", lastUsedAt: new Date() },
    });

    const origin = process.env.FRONTEND_URL || url.origin;
    return NextResponse.json(
      {
        success: true,
        file: "emergency-ip.json",
        ipAddress,
        message: "This IP address is approved for admin access.",
        loginUrl: `${origin.replace(/\/$/, "")}/admin/login`,
      },
      {
        headers: {
          "Cache-Control": "no-store",
          "Content-Disposition": 'attachment; filename="emergency-ip.json"',
          "Referrer-Policy": "no-referrer",
          "X-Content-Type-Options": "nosniff",
        },
      }
    );
  } catch {
    return new NextResponse("Emergency access is temporarily unavailable.", {
      status: 503,
      headers: { "Cache-Control": "no-store", "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}
