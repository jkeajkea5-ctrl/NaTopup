import "dotenv/config";
import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const requestedMinutes = Number(process.argv[2] || 30);
  const expiresInMinutes = Number.isFinite(requestedMinutes)
    ? Math.min(Math.max(Math.round(requestedMinutes), 5), 24 * 60)
    : 30;
  const admin = await prisma.adminUser.findFirst({
    where: { role: "SUPERADMIN", isActive: true },
  });
  if (!admin) throw new Error("No active SUPERADMIN account found");

  const token = crypto.randomBytes(32).toString("base64url");
  await prisma.adminInvite.create({
    data: {
      tokenHash: crypto.createHash("sha256").update(token).digest("hex"),
      createdByAdminId: admin.id,
      expiresAt: new Date(Date.now() + expiresInMinutes * 60_000),
    },
  });

  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
  console.log("\nOne-time admin IP allowlist URL:\n");
  console.log(`${frontendUrl.replace(/\/$/, "")}/admin/login?invite=${token}`);
  console.log(`\nExpires in ${expiresInMinutes} minutes and can be used once.\n`);
}

main()
  .catch((error) => {
    console.error(`Could not create admin invite: ${error instanceof Error ? error.message : "Unknown error"}`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
