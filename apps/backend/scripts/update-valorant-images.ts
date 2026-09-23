import dotenv from "dotenv";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { VALORANT_POINTS_ICON } from "../lib/valorantCatalogue";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });
dotenv.config({ path: path.resolve(__dirname, "../.env") });

async function main() {
  if (!process.env.DATABASE_URL?.startsWith("mongodb")) {
    throw new Error("A MongoDB DATABASE_URL is required.");
  }

  const db = new PrismaClient({ log: [] });
  try {
    const result = await db.product.updateMany({
      where: { game: { slug: "valorant" }, isActive: true },
      data: { iconUrl: VALORANT_POINTS_ICON },
    });
    if (!result.count) throw new Error("No active Valorant packages were found.");
    console.log(`Updated ${result.count} active Valorant package images.`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
