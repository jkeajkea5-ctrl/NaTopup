import { prisma } from "../lib/prisma";

async function main() {
  const orderResult: any = await prisma.$runCommandRaw({
    createIndexes: "Order",
    indexes: [
      {
        key: { checkoutRequestId: 1 },
        name: "Order_checkoutRequestId_key",
        unique: true,
        partialFilterExpression: { checkoutRequestId: { $type: "string" } },
      },
    ],
  });

  const rateLimitResult: any = await prisma.$runCommandRaw({
    createIndexes: "ApiRateLimit",
    indexes: [
      {
        key: { key: 1, windowStart: 1 },
        name: "ApiRateLimit_key_windowStart_key",
        unique: true,
      },
      { key: { expiresAt: 1 }, name: "ApiRateLimit_expiresAt_idx" },
    ],
  });

  console.log(JSON.stringify({
    orderIndexes: orderResult.numIndexesAfter,
    rateLimitIndexes: rateLimitResult.numIndexesAfter,
  }));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
