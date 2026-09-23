import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { ADMIN_COOKIE, SESSION_SECONDS, createAdminSession, getAdminSession, hashAdminPassword, isAdminIpRule, requireAdminWithIp, requireSuperAdmin, verifyAdminPassword } from "../../../../lib/adminAuth";
import { prisma } from "../../../../lib/prisma";

export const dynamic = "force-dynamic";

function error(message: string, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status });
}

export async function GET(request: Request) {
  const denied = await requireAdminWithIp(request);
  if (denied) return denied;
  const roleDenied = requireSuperAdmin(request);
  if (roleDenied) return roleDenied;
  try {
    const [admins, databaseAllowlist] = await Promise.all([
      prisma.adminUser.findMany({ orderBy: { createdAt: "asc" }, select: { id: true, username: true, email: true, role: true, isActive: true, createdAt: true, updatedAt: true } }),
      prisma.adminIpAllowlist.findMany({ orderBy: { createdAt: "asc" }, select: { id: true, ipAddress: true, label: true, isActive: true, lastUsedAt: true, createdAt: true } }),
    ]);
    const databaseIps = new Set(databaseAllowlist.map((entry) => entry.ipAddress));
    const environmentAllowlist = (process.env.ADMIN_ALLOWED_IPS || process.env.ADMIN_IP_ALLOWLIST || "")
      .split(",")
      .map((ipAddress) => ipAddress.trim().replace(/^::ffff:/i, ""))
      .filter((ipAddress) => isAdminIpRule(ipAddress) && !databaseIps.has(ipAddress))
      .map((ipAddress) => ({
        id: `environment:${ipAddress}`,
        ipAddress,
        label: "Configured in deployment environment",
        isActive: true,
        lastUsedAt: null,
        createdAt: null,
        locked: true,
      }));
    const allowlist = [...environmentAllowlist, ...databaseAllowlist.map((entry) => ({ ...entry, locked: false }))];
    const session = getAdminSession(request);
    const currentAdmin = admins.find((admin) => admin.id === session?.id) || null;
    return NextResponse.json({ success: true, data: { admins, allowlist, currentAdmin } }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return error("Security settings could not be loaded.", 503);
  }
}

export async function POST(request: Request) {
  const denied = await requireAdminWithIp(request);
  if (denied) return denied;
  const roleDenied = requireSuperAdmin(request);
  if (roleDenied) return roleDenied;
  const session = getAdminSession(request);
  const body = await request.json().catch(() => null);
  try {
    if (body?.action === "update-profile") {
      const username = typeof body.username === "string" ? body.username.trim() : "";
      const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
      const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : "";
      const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";
      if (!/^[a-zA-Z0-9_.-]{3,40}$/.test(username) || !/^\S+@\S+\.\S+$/.test(email)) {
        return error("Use a valid username and email address.");
      }
      if (newPassword && newPassword.length < 10) return error("The new password must be at least 10 characters.");
      const currentAdmin = await prisma.adminUser.findUnique({ where: { id: session!.id } });
      if (!currentAdmin || !verifyAdminPassword(currentPassword, currentAdmin.passwordHash)) return error("The current password is incorrect.", 403);
      const updated = await prisma.adminUser.update({
        where: { id: currentAdmin.id },
        data: {
          username,
          email,
          ...(newPassword ? { passwordHash: hashAdminPassword(newPassword) } : {}),
        },
        select: { id: true, username: true, email: true, role: true, isActive: true },
      });
      const response = NextResponse.json({ success: true, data: updated });
      response.cookies.set(ADMIN_COOKIE, createAdminSession({ id: updated.id, username: updated.username, role: updated.role as any }), {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/api/admin",
        maxAge: SESSION_SECONDS,
      });
      return response;
    }
    if (body?.action === "add-admin") {
      const username = typeof body.username === "string" ? body.username.trim() : "";
      const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
      const password = typeof body.password === "string" ? body.password : "";
      const role = ["ADMIN", "OPERATOR"].includes(body.role) ? body.role : "ADMIN";
      if (!/^[a-zA-Z0-9_.-]{3,40}$/.test(username) || !/^\S+@\S+\.\S+$/.test(email) || password.length < 10) {
        return error("Use a valid username and email; passwords must be at least 10 characters.");
      }
      const admin = await prisma.adminUser.create({ data: { username, email, passwordHash: hashAdminPassword(password), role, isActive: true } });
      return NextResponse.json({ success: true, data: { id: admin.id, username: admin.username, email: admin.email, role: admin.role } }, { status: 201 });
    }
    if (body?.action === "create-invite") {
      const token = crypto.randomBytes(32).toString("base64url");
      const minutes = Math.min(Math.max(Number(body.expiresInMinutes) || 30, 5), 24 * 60);
      await prisma.adminInvite.create({ data: { tokenHash: crypto.createHash("sha256").update(token).digest("hex"), createdByAdminId: session!.id, expiresAt: new Date(Date.now() + minutes * 60_000) } });
      const frontend = process.env.FRONTEND_URL || new URL(request.url).origin;
      return NextResponse.json({ success: true, data: { url: `${frontend.replace(/\/$/, "")}/admin/login?invite=${encodeURIComponent(token)}`, expiresInMinutes: minutes } });
    }
    if (body?.action === "add-ip") {
      const ipAddress = typeof body.ipAddress === "string" ? body.ipAddress.trim().replace(/^::ffff:/i, "") : "";
      if (!isAdminIpRule(ipAddress)) return error("Enter one exact IPv4 or IPv6 address.");
      const item = await prisma.adminIpAllowlist.upsert({ where: { ipAddress }, update: { label: body.label?.trim() || null, isActive: true }, create: { ipAddress, label: body.label?.trim() || null } });
      return NextResponse.json({ success: true, data: item });
    }
    if (body?.action === "remove-ip") {
      if (typeof body.id !== "string") return error("Allowlist record is required.");
      await prisma.adminIpAllowlist.update({ where: { id: body.id }, data: { isActive: false } });
      return NextResponse.json({ success: true, data: null });
    }
    if (body?.action === "toggle-admin") {
      if (typeof body.id !== "string" || body.id === session?.id) return error("You cannot disable your own account.");
      const admin = await prisma.adminUser.update({ where: { id: body.id }, data: { isActive: body.isActive === true } });
      return NextResponse.json({ success: true, data: { id: admin.id, isActive: admin.isActive } });
    }
    return error("Unknown security setting action.");
  } catch (err: any) {
    if (err?.code === "P2002") return error("That username, email, or IP address is already in use.", 409);
    return error("Security setting could not be saved.", 409);
  }
}
