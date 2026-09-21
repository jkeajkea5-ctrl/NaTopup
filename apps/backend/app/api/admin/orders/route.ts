import { requireAdminWithIp } from "../../../../lib/adminAuth";
import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";

export async function GET(request: Request) {
  const denied = await requireAdminWithIp(request);
  if (denied) return denied;
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const query = searchParams.get("q");

    const where: any = {};
    if (status && status !== "ALL") {
      where.status = status;
    }
    if (query) {
      where.OR = [
        { publicOrderId: { contains: query } },
        { playerId: { contains: query } },
        { playerName: { contains: query } },
      ];
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
