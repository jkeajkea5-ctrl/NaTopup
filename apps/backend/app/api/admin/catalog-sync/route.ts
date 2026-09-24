import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminWithIp } from "../../../../lib/adminAuth";
import { catalogSyncService } from "../../../../services/CatalogSyncService";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const requestSchema = z.object({ gameId: z.string().regex(/^[a-f\d]{24}$/i) }).strict();

export async function POST(request: Request) {
  const denied = await requireAdminWithIp(request);
  if (denied) return denied;
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ success: false, error: "Select a valid game before syncing." }, { status: 400 });
  try {
    const result = await catalogSyncService.syncGame(parsed.data.gameId);
    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || "Supplier catalog sync failed." }, { status: 502 });
  }
}
