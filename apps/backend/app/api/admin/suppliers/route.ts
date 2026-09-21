import { requireAdminWithIp } from "../../../../lib/adminAuth";
import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { supplierManager } from "../../../../suppliers/supplierManager";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const denied = await requireAdminWithIp(request);
  if (denied) return denied;
  try {
    const suppliers = await prisma.supplier.findMany({
      orderBy: { priority: "asc" },
      include: {
        _count: {
          select: { products: true, mappings: true },
        },
      },
    });

    const liveBalances = await supplierManager.getAllBalances();

    return NextResponse.json({
      success: true,
      data: {
        suppliers,
        liveBalances,
        updatedAt: new Date().toISOString(),
      },
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const denied = await requireAdminWithIp(request);
  if (denied) return denied;
  try {
    const body = await request.json();
    const { id, isEnabled, priority } = body;

    const updated = await prisma.supplier.update({
      where: { id },
      data: {
        isEnabled: isEnabled !== undefined ? isEnabled : undefined,
        priority: priority !== undefined ? priority : undefined,
      },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
