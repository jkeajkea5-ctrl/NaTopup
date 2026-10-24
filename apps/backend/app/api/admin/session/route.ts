import { NextResponse } from "next/server";
import { ADMIN_COOKIE, SESSION_SECONDS, createAdminSession, getActiveAdminSession, isAdminIpAllowed, getClientIp, hashAdminPassword, trustedAdminOrigin, verifyAdminPassword } from "../../../../lib/adminAuth";
import { prisma } from "../../../../lib/prisma";
import { checkRateLimit } from "../../../../lib/rateLimit";
import { rateLimitHeaders } from "../../../../lib/requestSecurity";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const allowed = await isAdminIpAllowed(request);
  const session = allowed ? await getActiveAdminSession(request) : null;
  return NextResponse.json({ success: true, data: { authenticated: !!session, allowed, ip: getClientIp(request), username: session?.username, role: session?.role } }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (!trustedAdminOrigin(request)) return NextResponse.json({ success: false, error: "Untrusted request origin." }, { status: 403 });
  if (!(await isAdminIpAllowed(request))) return NextResponse.json({ success: false, code: "ADMIN_IP_DENIED", error: "This network is not approved for admin access." }, { status: 403 });
  const ip = getClientIp(request);
  const limit = await checkRateLimit(`admin-login:${ip}`, { windowMs: 60_000, maxRequests: 10 });
  if (!limit.allowed) {
    return NextResponse.json(
      { success: false, error: limit.unavailable ? "Login security check unavailable." : "Too many attempts. Try again in a minute." },
      { status: limit.unavailable ? 503 : 429, headers: rateLimitHeaders(limit) }
    );
  }
  const body = await request.json().catch(() => null);
  if (typeof body?.username !== "string" || typeof body?.password !== "string") return NextResponse.json({ success: false, error: "Username and password are required." }, { status: 400 });
  const identifier = body.username.trim();
  const admin = await prisma.adminUser.findFirst({ where: { OR: [{ username: identifier }, { email: identifier.toLowerCase() }] } }).catch(() => null);
  if (!admin || !admin.isActive || !verifyAdminPassword(body.password, admin.passwordHash)) return NextResponse.json({ success: false, error: "Invalid username or password." }, { status: 401 });
  if (!admin.passwordHash.startsWith("scrypt$")) {
    await prisma.adminUser.update({ where: { id: admin.id }, data: { passwordHash: hashAdminPassword(body.password) } }).catch(() => undefined);
  }
  const response = NextResponse.json({ success: true, data: { authenticated: true, username: admin.username, role: admin.role } });
  response.cookies.set(ADMIN_COOKIE, createAdminSession({ id: admin.id, username: admin.username, role: admin.role as any }), {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/api/admin", maxAge: SESSION_SECONDS,
  });
  return response;
}

export async function DELETE(request: Request) {
  if (!trustedAdminOrigin(request)) return NextResponse.json({ success: false, error: "Untrusted request origin." }, { status: 403 });
  const response = NextResponse.json({ success: true, data: null });
  response.cookies.set(ADMIN_COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/api/admin", maxAge: 0 });
  return response;
}
