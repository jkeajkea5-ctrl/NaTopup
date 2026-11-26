import { NextResponse } from "next/server";
import { getAdminSession, requireAdminWithIp } from "../../../../../../lib/adminAuth";
import { prisma } from "../../../../../../lib/prisma";
import { supplierManager } from "../../../../../../suppliers/supplierManager";
import { fulfilmentService } from "../../../../../../services/FulfilmentService";
import { SupplierCode } from "@topup/shared";

// This is a read/reconciliation action only. It deliberately never invokes
// createOrder: an uncertain top-up must be resolved using its original ref.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const denied = await requireAdminWithIp(request);
  if (denied) return denied;
  const order = await prisma.order.findUnique({
    where: { id: params.id },
    include: { fulfilment: { include: { supplierOrders: { orderBy: { createdAt: "desc" }, take: 1 } } } },
  });
  if (!order?.fulfilment) return NextResponse.json({ success: false, error: "Supplier fulfilment not found." }, { status: 404 });
  const supplierOrder = order.fulfilment.supplierOrders[0];
  const reference = supplierOrder?.referenceCode || order.publicOrderId;
  const result = await supplierManager.checkOrderStatus(
    order.fulfilment.supplier as SupplierCode,
    order.fulfilment.supplierOrderId || supplierOrder?.supplierOrderId || reference,
    reference
  );
  if (result.isDelivered) await fulfilmentService.markFulfilmentDelivered(order.fulfilment.id);
  else if (result.isFailed) await fulfilmentService.markFulfilmentFailedForReview(order.fulfilment.id, result.errorMessage || "Supplier confirmed failure");
  await prisma.auditLog.create({ data: {
    adminUserId: getAdminSession(request)?.id,
    action: "SUPPLIER_STATUS_CHECKED",
    entity: "Order",
    entityId: order.id,
    newValue: JSON.stringify({ supplier: order.fulfilment.supplier, reference, status: result.status }),
  } });
  return NextResponse.json({ success: true, data: { status: result.status, delivered: result.isDelivered, failed: result.isFailed } });
}
