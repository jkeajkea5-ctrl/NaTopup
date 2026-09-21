import { requireAdminWithIp } from "../../../../lib/adminAuth";
import { NextResponse } from "next/server";
import { OrderStatus } from "@topup/shared";
import { prisma } from "../../../../lib/prisma";
import { supplierManager } from "../../../../suppliers/supplierManager";

export async function GET(request: Request) {
  const denied = await requireAdminWithIp(request);
  if (denied) return denied;
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [
      allOrders,
      todayOrders,
      paidOrdersCount,
      deliveredOrdersCount,
      processingOrdersCount,
      failedOrdersCount,
      reviewOrdersCount,
    ] = await Promise.all([
      prisma.order.findMany({
        where: {
          status: {
            in: [OrderStatus.PAID, OrderStatus.PROCESSING, OrderStatus.DELIVERED],
          },
        },
        select: {
          total: true,
          supplierCostSnapshot: true,
        },
      }),
      prisma.order.count({
        where: { createdAt: { gte: todayStart } },
      }),
      prisma.order.count({
        where: { status: OrderStatus.PAID },
      }),
      prisma.order.count({
        where: { status: OrderStatus.DELIVERED },
      }),
      prisma.order.count({
        where: { status: OrderStatus.PROCESSING },
      }),
      prisma.order.count({
        where: { status: OrderStatus.FAILED },
      }),
      prisma.order.count({
        where: { status: OrderStatus.REVIEW_REQUIRED },
      }),
    ]);

    // Financial calculations
    let totalRevenue = 0;
    let totalSupplierCost = 0;

    for (const ord of allOrders) {
      totalRevenue += ord.total;
      totalSupplierCost += ord.supplierCostSnapshot;
    }

    const grossProfit = Math.round((totalRevenue - totalSupplierCost) * 100) / 100;
    const profitMargin = totalRevenue > 0
      ? Math.round((grossProfit / totalRevenue) * 1000) / 10
      : 0;

    // Supplier balances
    const supplierBalances = await supplierManager.getAllBalances();

    // Recent orders
    const recentOrders = await prisma.order.findMany({
      take: 10,
      orderBy: { createdAt: "desc" },
      include: {
        game: { select: { name: true, slug: true } },
        product: { select: { name: true, amount: true } },
        payment: { select: { status: true, providerTransactionId: true } },
        fulfilment: { select: { status: true, supplier: true, supplierOrderId: true } },
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        metrics: {
          totalRevenue: Math.round(totalRevenue * 100) / 100,
          grossProfit,
          profitMargin,
          totalSupplierCost: Math.round(totalSupplierCost * 100) / 100,
          todayOrders,
          paidOrders: paidOrdersCount,
          deliveredOrders: deliveredOrdersCount,
          processingOrders: processingOrdersCount,
          failedOrders: failedOrdersCount,
          reviewOrders: reviewOrdersCount,
        },
        supplierBalances,
        recentOrders,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
