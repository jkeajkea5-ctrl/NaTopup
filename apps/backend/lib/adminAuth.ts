import crypto from "node:crypto";
import net from "node:net";
import { NextResponse } from "next/server";
import { prisma } from "./prisma";

export const ADMIN_COOKIE = "na_admin_session";
export const SESSION_SECONDS = 8 * 60 * 60;

export type AdminRole = "SUPERADMIN" | "ADMIN" | "OPERATOR";
export type AdminSession = { id: string; username: string; role: AdminRole; expiresAt: number };

function secret() {
  const key = process.env.AUTH_SECRET || process.env.ADMIN_DASHBOARD_KEY || (process.env.NODE_ENV !== "production" ? "local-development-admin-secret-change-me-32" : "");
  return key.length >= 32 ? key : "";
}

export function hashAdminPassword(password: string) {
  const salt = crypto.randomBytes(16).toString("hex");
  return `scrypt$${salt}$${crypto.scryptSync(password, salt, 64).toString("hex")}`;
}

export function verifyAdminPassword(password: unknown, encoded: string) {
  if (typeof password !== "string" || !password || !encoded) return false;
  try {
    if (encoded.startsWith("scrypt$")) {
      const [, salt, expected] = encoded.split("$");
      if (!salt || !expected || !/^[a-f\d]{128}$/i.test(expected)) return false;
      return crypto.timingSafeEqual(crypto.scryptSync(password, salt, 64), Buffer.from(expected, "hex"));
    }
    // Backward compatibility for the original seeded account; successful login upgrades it.
    const actual = crypto.createHash("sha256").update(password).digest("hex");
    return /^[a-f\d]{64}$/i.test(encoded) && crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(encoded));
  } catch { return false; }
}

function sign(payload: string) {
  const key = secret();
  if (!key) throw new Error("AUTH_SECRET must contain at least 32 characters");
  return crypto.createHmac("sha256", key).update(payload).digest("hex");
}

export function createAdminSession(admin: Partial<AdminSession> = {}) {
  const expiresAt = Date.now() + SESSION_SECONDS * 1000;
  const payload = [expiresAt, crypto.randomBytes(16).toString("hex"), admin.id || "legacy", admin.username || "admin", admin.role || "SUPERADMIN"].join(".");
  return `${payload}.${sign(payload)}`;
}

function cookieValue(request: Request) {
  return namedCookieValue(request, ADMIN_COOKIE);
}

function namedCookieValue(request: Request, name: string) {
  return request.headers.get("cookie")?.split(";").map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1) || "";
}

export function getAdminSession(request: Request): AdminSession | null {
  const [expires, nonce, id, username, role, signature, extra] = cookieValue(request).split(".");
  if (!secret() || extra || !/^\d+$/.test(expires || "") || !/^[a-f\d]{32}$/i.test(nonce || "") || !id || !username ||
      !["SUPERADMIN", "ADMIN", "OPERATOR"].includes(role || "") || !/^[a-f\d]{64}$/i.test(signature || "") || Number(expires) <= Date.now()) return null;
  const payload = [expires, nonce, id, username, role].join(".");
  if (!crypto.timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(sign(payload), "hex"))) return null;
  return { id, username, role: role as AdminRole, expiresAt: Number(expires) };
}

export function hasAdminSession(request: Request) { return !!getAdminSession(request); }

export async function getActiveAdminSession(request: Request) {
  const session = getAdminSession(request);
  if (!session) return null;
  try {
    const admin = await prisma.adminUser.findUnique({
      where: { id: session.id },
      select: { username: true, role: true, isActive: true },
    });
    if (!admin?.isActive || admin.username !== session.username || admin.role !== session.role) return null;
    return session;
  } catch {
    return null;
  }
}

// Kept as a compatibility export for existing integrations; new logins use username/password.
export function validAdminKey(value: unknown) {
  const expected = process.env.ADMIN_DASHBOARD_KEY || "";
  return !!expected && typeof value === "string" && value.length === expected.length && crypto.timingSafeEqual(Buffer.from(value), Buffer.from(expected));
}

export function trustedAdminOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const allowed = (process.env.ADMIN_DASHBOARD_ORIGIN || `${process.env.FRONTEND_URL || "http://localhost:5173"},http://localhost:5200,http://127.0.0.1:5173,http://127.0.0.1:5200`)
    .split(",").map((value) => value.trim()).filter(Boolean);
  return !origin ? ["GET", "HEAD"].includes(request.method) : allowed.includes(origin);
}

export function getClientIp(request: Request) {
  const candidate = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip")?.trim() || "127.0.0.1";
  const normalized = candidate.replace(/^::ffff:/i, "");
  return net.isIP(normalized) ? normalized : "unknown";
}

export function getIpv4SubnetRule(ip: string) {
  if (net.isIP(ip) !== 4) return null;
  return `${ip.split(".").slice(0, 3).join(".")}.0/24`;
}

export function isAdminIpRule(value: string) {
  if (net.isIP(value)) return true;
  const match = value.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.0\/24$/);
  return !!match && match.slice(1).every((part) => Number(part) <= 255);
}

export function adminIpRuleMatches(ip: string, rule: string) {
  if (ip === rule) return true;
  const subnet = getIpv4SubnetRule(ip);
  return !!subnet && subnet === rule;
}

function configuredIps() {
  return (process.env.ADMIN_ALLOWED_IPS || "").split(",").map((value) => value.trim()).filter(isAdminIpRule);
}

export async function isAdminIpAllowed(request: Request) {
  const ip = getClientIp(request);
  if (configuredIps().some((rule) => adminIpRuleMatches(ip, rule))) return true;
  if (process.env.NODE_ENV !== "production" && ["127.0.0.1", "::1"].includes(ip)) return true;
  if (ip === "unknown") return false;
  try {
    const rules = await prisma.adminIpAllowlist.findMany({ where: { isActive: true }, select: { ipAddress: true } });
    return rules.some((rule) => adminIpRuleMatches(ip, rule.ipAddress));
  } catch { return false; }
}

export function requireAdmin(request: Request) {
  if (!getAdminSession(request)) return NextResponse.json({ success: false, error: "Please sign in to the admin dashboard." }, { status: 401 });
  if (!trustedAdminOrigin(request)) return NextResponse.json({ success: false, error: "Untrusted request origin." }, { status: 403 });
  return null;
}

export async function requireAdminWithIp(request: Request) {
  if (!trustedAdminOrigin(request)) return NextResponse.json({ success: false, error: "Untrusted request origin." }, { status: 403 });
  if (!(await getActiveAdminSession(request))) return NextResponse.json({ success: false, error: "Please sign in to the admin dashboard." }, { status: 401 });
  if (!(await isAdminIpAllowed(request))) return NextResponse.json({ success: false, error: "This network is not approved for admin access." }, { status: 403 });
  return null;
}

export function requireSuperAdmin(request: Request) {
  const session = getAdminSession(request);
  if (!session || session.role !== "SUPERADMIN") return NextResponse.json({ success: false, error: "Only the main administrator can change security settings." }, { status: 403 });
  return null;
}
