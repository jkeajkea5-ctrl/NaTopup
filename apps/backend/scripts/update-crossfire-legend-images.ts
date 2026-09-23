import dotenv from "dotenv";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { getCrossfireLegendIconUrl } from "../lib/crossfireLegendCatalogue";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });
dotenv.config({ path: path.resolve(__dirname, "../.env") });

async function main() {
  if (!process.env.DATABASE_URL?.startsWith("mongodb")) {
    throw new Error("A MongoDB DATABASE_URL is required.");
  }

  const db = new PrismaClient({ log: [] });
  try {
    const products = await db.product.findMany({
      where: { game: { slug: "crossfire-legend" }, isActive: true },
      select: { id: true, name: true, amount: true },
    });
    if (!products.length) throw new Error("No active Crossfire: Legend packages were found.");

    await db.$transaction(
      products.map((product) => db.product.update({
        where: { id: product.id },
        data: { iconUrl: getCrossfireLegendIconUrl(product.amount || product.name) },
      }))
    );

    console.log(`Updated ${products.length} active Crossfire: Legend package images.`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
