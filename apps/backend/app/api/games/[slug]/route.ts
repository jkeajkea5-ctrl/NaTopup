import { NextResponse } from "next/server";
import { prisma, safeDbQuery } from "../../../../lib/prisma";
import { config } from "../../../../lib/config";
import { FALLBACK_GAMES } from "../../../../lib/fallbackData";
import { g2bulkAdapter } from "../../../../suppliers/g2bulk/client";

const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

let cachedValKhProducts: any[] | null = null;
let lastValKhFetch = 0;

async function getLiveG2BulkValorantKhProducts() {
  const now = Date.now();
  if (cachedValKhProducts && now - lastValKhFetch < CACHE_TTL_MS) {
    return cachedValKhProducts;
  }

  try {
    const rawItems = await g2bulkAdapter.getValorantKhCatalogue();
    if (rawItems && rawItems.length > 0) {
      cachedValKhProducts = rawItems.map((item: any) => {
        const cost = typeof item.amount === "number" ? item.amount : parseFloat(item.amount || 0);
        const markup = Math.max(0.10, Math.round(cost * 0.06 * 100) / 100);
        const finalPriceUsd = Math.round((cost + markup) * 100) / 100;
        const finalPriceKhr = Math.ceil((finalPriceUsd * config.business.usdToKhrRate) / 100) * 100;

        return {
          id: `g2b_val_kh_${item.id}`,
          sku: `G2B_VAL_KH_${item.name}`,
          name: `${item.name} Points`,
          description: `Instant Direct Top-Up via G2Bulk Cambodia Server (${item.name} VP)`,
          amount: item.name,
          isPopular: ["1000", "5350"].includes(item.name),
          isFeatured: item.name === "11000",
          priceUsd: finalPriceUsd,
          discountUsd: 0,
          finalPriceUsd,
          finalPriceKhr,
          supplierCost: cost,
          catalogueName: item.name,
          supplier: "G2BULK",
          supplierGameCode: "valorant_kh",
        };
      });
      lastValKhFetch = now;
      return cachedValKhProducts;
    }
  } catch (err: any) {
    console.warn("Could not fetch live G2Bulk Valorant KH catalogue:", err.message);
  }
  return null;
}

let cachedValSgProducts: any[] | null = null;
let lastValSgFetch = 0;

async function getLiveG2BulkValorantSgProducts() {
  const now = Date.now();
  if (cachedValSgProducts && now - lastValSgFetch < CACHE_TTL_MS) {
    return cachedValSgProducts;
  }

  try {
    const rawItems = await g2bulkAdapter.getValorantSgCatalogue();
    if (rawItems && rawItems.length > 0) {
      cachedValSgProducts = rawItems.map((item: any) => {
        const cost = typeof item.amount === "number" ? item.amount : parseFloat(item.amount || 0);
        const markup = Math.max(0.10, Math.round(cost * 0.06 * 100) / 100);
        const finalPriceUsd = Math.round((cost + markup) * 100) / 100;
        const finalPriceKhr = Math.ceil((finalPriceUsd * config.business.usdToKhrRate) / 100) * 100;

        return {
          id: `g2b_val_sg_${item.id}`,
          sku: `G2B_VAL_SG_${item.name}`,
          name: `${item.name} Points`,
          description: `Instant Direct Top-Up via G2Bulk Singapore Server (${item.name} VP)`,
          amount: item.name,
          isPopular: ["1000", "5350"].includes(item.name),
          isFeatured: item.name === "11000",
          priceUsd: finalPriceUsd,
          discountUsd: 0,
          finalPriceUsd,
          finalPriceKhr,
          supplierCost: cost,
          catalogueName: item.name,
          supplier: "G2BULK",
          supplierGameCode: "valorant_sg",
        };
      });
      lastValSgFetch = now;
      return cachedValSgProducts;
    }
  } catch (err: any) {
    console.warn("Could not fetch live G2Bulk Valorant SG catalogue:", err.message);
  }
  return null;
}

export async function GET(
  request: Request,
  { params }: { params: { slug: string } }
) {
  const { slug } = params;
  const normalizedSlug = slug === "mlbb" ? "mobile-legends" : slug === "valorant-cambodia" ? "valorant" : slug === "free-fire-khsgmy" ? "free-fire" : slug;

  // For other games, query DB safely with fast timeout
  const game = await safeDbQuery(
    async () => {
      return prisma.game.findUnique({
        where: { slug: normalizedSlug },
        include: {
          fields: { orderBy: { sortOrder: "asc" } },
          products: {
            where: { isActive: true },
            orderBy: [{ isPopular: "desc" }, { sortOrder: "asc" }],
            include: { price: true },
          },
        },
      });
    },
    null,
    ["mobile-legends", "free-fire", "pubg-mobile", "valorant", "zepeto", "delta-force", "blood-strike", "magic-chess-gogo", "crossfire-legend"].includes(normalizedSlug) ? 5000 : 800
  );

  if (game && !game.isActive) {
    return NextResponse.json({ success: false, error: { message: "Game is unavailable." } }, { status: 404 });
  }

  if (game && game.isActive) {
    const formattedProducts = game.products.map((p) => {
      const sellingPrice = p.price?.sellingPrice || 0;
      const discount = p.price?.discount || 0;
      const finalPriceUsd = Math.max(0.01, Math.round((sellingPrice - discount) * 100) / 100);
      const finalPriceKhr = Math.ceil((finalPriceUsd * config.business.usdToKhrRate) / 100) * 100;

      return {
        id: p.id,
        sku: p.sku,
        name: p.name,
        description: p.description,
        amount: p.amount,
        iconUrl: p.iconUrl,
        isPopular: p.isPopular,
        isFeatured: p.isFeatured,
        priceUsd: sellingPrice,
        discountUsd: discount,
        finalPriceUsd,
        finalPriceKhr,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        game: {
          id: game.id,
          slug: game.slug,
          name: game.name,
          category: game.category,
          logoUrl: game.logoUrl,
          bannerUrl: game.bannerUrl,
          region: game.region,
          instructions: game.instructions,
          deliveryTime: game.deliveryTime,
          fields: game.fields.map((f) => ({
            id: f.id,
            fieldKey: f.fieldKey,
            fieldLabel: f.fieldLabel,
            placeholder: f.placeholder,
            fieldType: f.fieldType,
            options: f.options ? JSON.parse(f.options) : null,
            isRequired: f.isRequired,
            helperText: f.helperText,
          })),
        },
        products: formattedProducts,
      },
    });
  }

  // For Valorant SG (valorant-sg)
  if (normalizedSlug === "valorant-sg") {
    const liveProducts = await getLiveG2BulkValorantSgProducts();
    const fallbackValSg = FALLBACK_GAMES.find((g) => g.slug === "valorant-sg")!;

    return NextResponse.json({
      success: true,
      data: {
        game: {
          id: fallbackValSg.id,
          slug: "valorant-sg",
          name: fallbackValSg.name,
          category: fallbackValSg.category,
          logoUrl: fallbackValSg.logoUrl,
          bannerUrl: fallbackValSg.bannerUrl,
          region: "Singapore Server (G2Bulk)",
          instructions: fallbackValSg.instructions,
          deliveryTime: "Instant (30 seconds)",
          fields: fallbackValSg.fields,
        },
        products: liveProducts && liveProducts.length > 0 ? liveProducts : fallbackValSg.products,
      },
    });
  }


  // Imported catalog games must only expose saved MongoDB products, never stale fallback packages.
  if (["mobile-legends", "free-fire", "pubg-mobile", "valorant", "zepeto", "delta-force", "blood-strike", "magic-chess-gogo", "crossfire-legend"].includes(normalizedSlug)) {
    return NextResponse.json(
      { success: false, error: { message: "Game packages are temporarily unavailable. Please try again shortly." } },
      { status: 503 }
    );
  }

  // Fallback
  const fallback = FALLBACK_GAMES.find((g) => g.slug === normalizedSlug);
  if (fallback) {
    return NextResponse.json({
      success: true,
      data: {
        game: {
          id: fallback.id,
          slug: fallback.slug,
          name: fallback.name,
          category: fallback.category,
          logoUrl: fallback.logoUrl,
          bannerUrl: fallback.bannerUrl,
          region: fallback.region,
          instructions: fallback.instructions,
          deliveryTime: fallback.deliveryTime,
          fields: fallback.fields,
        },
        products: fallback.products,
      },
    });
  }

  return NextResponse.json(
    { success: false, error: { message: "Game not found" } },
    { status: 404 }
  );
}
