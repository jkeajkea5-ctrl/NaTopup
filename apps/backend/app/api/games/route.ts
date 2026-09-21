import { NextResponse } from "next/server";
import { prisma, safeDbQuery } from "../../../lib/prisma";
import { FALLBACK_GAMES, FALLBACK_PROMOTIONS } from "../../../lib/fallbackData";

export const dynamic = "force-dynamic";

export async function GET() {
  const result = await safeDbQuery<{ games: any[]; promotions: any[] }>(
    async () => {
      const games = await prisma.game.findMany({
        where: { isActive: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: {
          id: true,
          slug: true,
          name: true,
          category: true,
          logoUrl: true,
          bannerUrl: true,
          region: true,
          deliveryTime: true,
          isPopular: true,
          _count: {
            select: { products: { where: { isActive: true } } },
          },
        },
      });

      const promotions = await prisma.promotion.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
      });

      return { games, promotions };
    },
    { games: FALLBACK_GAMES, promotions: FALLBACK_PROMOTIONS },
    5000
  );

  return NextResponse.json({
    success: true,
    data: {
      games: result.games,
      promotions: result.promotions,
    },
  });
}
