import { getAdminSession, requireAdminWithIp } from "../../../../lib/adminAuth";
import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";

export async function GET(request: Request) {
  const denied = await requireAdminWithIp(request);
  if (denied) return denied;
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const query = searchParams.get("q");

    const visibleOrders = { OR: [{ archivedAt: null }, { archivedAt: { isSet: false } }] };
    const where: any = { ...visibleOrders };
    if (status && status !== "ALL") {
      where.status = status;
    }
    if (query) {
      where.AND = [visibleOrders, { OR: [
          { publicOrderId: { contains: query } },
          { playerId: { contains: query } },
          { playerName: { contains: query } },
        ] }];
      delete where.OR;
    }

    const orders = await prisma.order.findMany({
      where,
      take: 50,
      orderBy: { createdAt: "desc" },
      include: {
        game: { select: { name: true, slug: true, logoUrl: true } },
        product: { select: { name: true, amount: true } },
        payment: true,
        fulfilment: {
          include: {
            supplierOrders: true,
          },
        },
        events: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: orders,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

const deletableStatuses = new Set(["AWAITING_PAYMENT", "DELIVERED", "FAILED", "EXPIRED"]);

class OrderArchiveError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export async function DELETE(request: Request) {
  const denied = await requireAdminWithIp(request);
  if (denied) return denied;
  const body = await request.json().catch(() => null);
  const id = typeof body?.id === "string" && /^[a-f\d]{24}$/i.test(body.id) ? body.id : "";
  if (!id) return NextResponse.json({ success: false, error: "A valid order is required." }, { status: 400 });
  const session = getAdminSession(request);
  try {
    const result = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id },
        select: { id: true, publicOrderId: true, status: true, archivedAt: true, payment: { select: { status: true, verifiedAt: true } } },
      });
      if (!order) throw new OrderArchiveError("Order not found.", 404);
      if (order.archivedAt) return { id: order.id, publicOrderId: order.publicOrderId };
      const completedDelivery = order.status === "DELIVERED";
      if (!deletableStatuses.has(order.status) || (!completedDelivery && (order.payment?.verifiedAt || order.payment?.status === "PAID"))) {
        throw new OrderArchiveError("Paid orders still being fulfilled, processing orders, and review orders cannot be removed.", 409);
      }
      const archivedAt = new Date();
      await tx.order.update({ where: { id }, data: { archivedAt } });
      await tx.auditLog.create({ data: {
        adminUserId: session?.id,
        action: "ORDER_ARCHIVED",
        entity: "Order",
        entityId: id,
        oldValue: JSON.stringify({ status: order.status, archivedAt: null }),
        newValue: JSON.stringify({ archivedAt: archivedAt.toISOString() }),
      } });
      return { id: order.id, publicOrderId: order.publicOrderId };
    });
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof OrderArchiveError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    }
    return NextResponse.json({ success: false, error: "The order could not be removed. Refresh and try again." }, { status: 409 });
  }
}
