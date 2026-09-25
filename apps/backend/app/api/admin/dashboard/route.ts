import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { requireAdminWithIp } from "../../../../lib/adminAuth";
import { adminMutation } from "../../../../lib/adminValidation";
import { cambodiaDayRange } from "../../../../lib/cambodiaTime";

export const dynamic = "force-dynamic";

class AdminInputError extends Error {}

export async function GET(request: Request) {
  const denied = await requireAdminWithIp(request);
  if (denied) return denied;
  try {
    const paid = { status: { in: ["PAID", "PROCESSING", "DELIVERED"] } };
    const today = cambodiaDayRange();
    const [orders, orderCount, games, products, slides, users, suppliers, totals, dailyTotals, completed] = await Promise.all([
      prisma.order.findMany({ take: 250, orderBy: { createdAt: "desc" }, select: {
        id: true, publicOrderId: true, createdAt: true, status: true, playerId: true, playerName: true, total: true,
        gameId: true, productId: true, payment: { select: { status: true } },
      } }),
      prisma.order.count(),
      prisma.game.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: {
        id: true, name: true, slug: true, category: true, logoUrl: true, bannerUrl: true, sortOrder: true, isActive: true, isPopular: true,
      } }),
      prisma.product.findMany({ orderBy: { sortOrder: "asc" }, select: {
        id: true, name: true, amount: true, sku: true, gameId: true, iconUrl: true, customBadge: true, isActive: true, isPopular: true, isFeatured: true, sortOrder: true,
        price: { select: { sellingPrice: true, discount: true, supplierCost: true } },
        mappings: {
          where: { isEnabled: true },
          orderBy: { priority: "asc" },
          take: 1,
          select: {
            supplier: { select: { code: true } },
            supplierProduct: { select: { currentCost: true } },
          },
        },
        _count: { select: { mappings: true } },
      } }),
      prisma.promotion.findMany({ orderBy: { sortOrder: "asc" } }),
      prisma.user.findMany({ take: 250, orderBy: { createdAt: "desc" }, select: {
        id: true, name: true, email: true, createdAt: true, _count: { select: { orders: true } },
      } }),
      prisma.supplier.findMany({ orderBy: { priority: "asc" }, select: {
        id: true, code: true, name: true, isEnabled: true, priority: true, balance: true, currency: true, healthStatus: true, lastChecked: true,
      } }),
      prisma.order.aggregate({ where: paid, _sum: { total: true, supplierCostSnapshot: true }, _count: true }),
      prisma.order.aggregate({
        where: {
          ...paid,
          paidAt: { gte: today.start, lt: today.end },
        },
        _sum: { total: true, supplierCostSnapshot: true },
        _count: true,
      }),
      prisma.order.count({ where: { status: "DELIVERED" } }),
    ]);
    const gameMap = new Map(games.map((game) => [game.id, game]));
    const productMap = new Map(products.map((product) => [product.id, product]));
    const missingGame = { name: "Missing game record", logoUrl: "" };
    return NextResponse.json({ success: true, data: {
      orders: orders.map((order) => ({
        ...order,
        game: {
          name: gameMap.get(order.gameId)?.name || "Missing game record",
          logoUrl: gameMap.get(order.gameId)?.logoUrl || "",
        },
        product: {
          name: productMap.get(order.productId)?.name || "Missing package record",
          iconUrl: productMap.get(order.productId)?.iconUrl || "",
        },
      })),
      orderCount, games, products: products.map(({ mappings, ...product }) => ({
        ...product,
        game: gameMap.get(product.gameId) || missingGame,
        orphaned: !gameMap.has(product.gameId),
        importCost: mappings[0]?.supplierProduct.currentCost ?? null,
        importSupplier: mappings[0]?.supplier.code ?? null,
      })), slides, users, suppliers,
      orphanedProducts: products.filter((product) => !gameMap.has(product.gameId)).length,
      metrics: {
        revenue: totals._sum.total || 0,
        cost: totals._sum.supplierCostSnapshot || 0,
        paidOrders: totals._count,
        completed,
        daily: {
          revenue: dailyTotals._sum.total || 0,
          cost: dailyTotals._sum.supplierCostSnapshot || 0,
          profit: (dailyTotals._sum.total || 0) - (dailyTotals._sum.supplierCostSnapshot || 0),
          paidOrders: dailyTotals._count,
        },
      },
      updatedAt: new Date().toISOString(),
    } }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ success: false, error: "Could not load NA TOPUP data. Check the backend database connection and retry." }, { status: 503 });
  }
}

export async function PATCH(request: Request) {
  const denied = await requireAdminWithIp(request);
  if (denied) return denied;
  const parsed = adminMutation.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ success: false, error: parsed.error.issues[0]?.message || "Invalid changes" }, { status: 400 });
  const mutation = parsed.data;
  try {
    // Persist both the change and audit record together; never acknowledge a browser-only save.
    await prisma.$transaction(async (tx) => {
      let entityId = mutation.id || "";
      if (mutation.entity === "game") {
        await tx.game.update({ where: { id: mutation.id }, data: mutation.data });
      } else if (mutation.entity === "package") {
        const { sellingPrice, supplierCost: _submittedSupplierCost, discount, category, ...data } = mutation.data;
        const currentPrice = await tx.productPrice.findUnique({
          where: { productId: mutation.id },
          select: { supplierCost: true },
        });
        if (!currentPrice) throw new AdminInputError("Package pricing is unavailable.");
        const primaryMapping = await tx.supplierMapping.findFirst({
          where: { productId: mutation.id, isEnabled: true },
          orderBy: { priority: "asc" },
          select: {
            supplier: { select: { code: true } },
            supplierProduct: { select: { currentCost: true } },
          },
        });
        const importCost = primaryMapping?.supplierProduct.currentCost;
        const fixedSupplierCost = importCost ?? currentPrice.supplierCost;
        if (sellingPrice - discount + Number.EPSILON < fixedSupplierCost) {
          throw new AdminInputError(`Customer price cannot be below the fixed supplier cost of $${fixedSupplierCost.toFixed(3)}.`);
        }
        await tx.product.update({ where: { id: mutation.id }, data: {
          ...data,
          customBadge: data.customBadge || null,
          isPopular: category === "pass",
          isFeatured: category === "other",
        } });
        await tx.productPrice.update({ where: { productId: mutation.id }, data: { sellingPrice, supplierCost: fixedSupplierCost, discount, pricingStrategy: "MANUAL" } });
      } else if (mutation.entity === "slide") {
        const slide = mutation.id
          ? await tx.promotion.update({ where: { id: mutation.id }, data: mutation.data })
          : await tx.promotion.create({ data: mutation.data });
        entityId = slide.id;
      } else {
        await tx.supplier.update({ where: { id: mutation.id }, data: mutation.data });
      }
      await tx.auditLog.create({ data: {
        action: "ADMIN_DASHBOARD_SAVE", entity: mutation.entity, entityId, newValue: JSON.stringify(mutation.data),
      } });
    });
    return NextResponse.json({ success: true, data: { saved: true } });
  } catch (error) {
    if (error instanceof AdminInputError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: "Changes could not be saved. The record may be unavailable; refresh and try again." }, { status: 409 });
  }
}
