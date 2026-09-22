import crypto from "node:crypto";
import net from "node:net";
import { NextResponse } from "next/server";
import { getClientIp, getIpv4SubnetRule } from "../../../../lib/adminAuth";
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

    const savedSubnet = getIpv4SubnetRule(ipAddress);
    if (savedSubnet) {
      await prisma.adminIpAllowlist.upsert({
        where: { ipAddress: savedSubnet },
        update: { isActive: true, label: "Emergency mobile subnet", lastUsedAt: new Date() },
        create: { ipAddress: savedSubnet, isActive: true, label: "Emergency mobile subnet", lastUsedAt: new Date() },
      });
    }

    const origin = process.env.FRONTEND_URL || url.origin;
    const loginUrl = `${origin.replace(/\/$/, "")}/admin/login`;

    if (url.searchParams.get("redirect") === "1") {
      const response = NextResponse.redirect(loginUrl, 302);
      response.headers.set("Cache-Control", "no-store");
      response.headers.set("Referrer-Policy", "no-referrer");
      response.headers.set("X-Content-Type-Options", "nosniff");
      return response;
    }

    const response = NextResponse.json(
      {
        success: true,
        message: "Success! Your IP subnet has been added to the whitelist.",
        saved_subnet: savedSubnet ? savedSubnet.replace(/0\/24$/, "") : ipAddress,
        your_original_ip: ipAddress,
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
    return response;
  } catch {
    return new NextResponse("Emergency access is temporarily unavailable.", {
      status: 503,
      headers: { "Cache-Control": "no-store", "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}
