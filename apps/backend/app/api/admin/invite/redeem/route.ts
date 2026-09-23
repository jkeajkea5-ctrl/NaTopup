import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { getClientIp, isAdminIpRule, trustedAdminOrigin } from "../../../../../lib/adminAuth";
import { prisma } from "../../../../../lib/prisma";

export async function POST(request: Request) {
  if (!trustedAdminOrigin(request)) return NextResponse.json({ success: false, error: "Untrusted request origin." }, { status: 403 });
  const body = await request.json().catch(() => null);
  if (typeof body?.token !== "string" || body.token.length < 20) return NextResponse.json({ success: false, error: "Invalid invite link." }, { status: 400 });
  const ipAddress = getClientIp(request);
  if (!isAdminIpRule(ipAddress)) return NextResponse.json({ success: false, error: "Your network address could not be verified." }, { status: 400 });
  const tokenHash = crypto.createHash("sha256").update(body.token).digest("hex");
  try {
    const invite = await prisma.adminInvite.findFirst({ where: { tokenHash, usedAt: null, expiresAt: { gt: new Date() } } });
    if (!invite) return NextResponse.json({ success: false, error: "This invite link is expired or has already been used." }, { status: 410 });
    const claimed = await prisma.adminInvite.updateMany({ where: { id: invite.id, usedAt: null }, data: { usedAt: new Date(), usedIp: ipAddress } });
    if (claimed.count !== 1) return NextResponse.json({ success: false, error: "This invite link has already been used." }, { status: 410 });
    await prisma.adminIpAllowlist.upsert({ where: { ipAddress }, update: { isActive: true, lastUsedAt: new Date() }, create: { ipAddress, label: "Added through invite link", isActive: true, lastUsedAt: new Date() } });
    return NextResponse.json({ success: true, data: { ip: ipAddress } }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ success: false, error: "The invite could not be redeemed." }, { status: 503 });
  }
}
