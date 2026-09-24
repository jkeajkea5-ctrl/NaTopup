import dotenv from "dotenv";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const GAME_SLUGS = [
  "mobile-legends",
  "mobile-legends-philippines",
  "mobile-legends-indonesia",
];
const BEST_SELLING_NAMES = [
  "Weekly Elite Pack",
  "Weekly Diamond Pass",
  "Monthly Elite Pack",
  "Twilight Pass",
];

async function main() {
  if (!process.env.DATABASE_URL?.startsWith("mongodb")) {
    throw new Error("A MongoDB DATABASE_URL is required.");
  }

  const db = new PrismaClient({ log: [] });
  try {
    const gameIds = (await db.game.findMany({
      where: { slug: { in: GAME_SLUGS } },
      select: { id: true },
    })).map((game) => game.id);

    if (gameIds.length !== GAME_SLUGS.length) {
      throw new Error("All three Mobile Legends game entries must exist before updating categories.");
    }

    const result = await db.$transaction(async (tx) => {
      const cleared = await tx.product.updateMany({
        where: { gameId: { in: gameIds }, isPopular: true },
        data: { isPopular: false },
      });
      const promoted = await tx.product.updateMany({
        where: {
          gameId: { in: gameIds },
          isActive: true,
          name: { in: BEST_SELLING_NAMES },
        },
        data: { isPopular: true },
      });
      return { cleared: cleared.count, promoted: promoted.count };
    });

    const selected = await db.product.findMany({
      where: { gameId: { in: gameIds }, isActive: true, isPopular: true },
      select: { name: true, game: { select: { slug: true } } },
      orderBy: [{ gameId: "asc" }, { sortOrder: "asc" }],
    });
    console.log(JSON.stringify({ ...result, selected }));
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
