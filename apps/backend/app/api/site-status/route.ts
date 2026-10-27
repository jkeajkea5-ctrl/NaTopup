import { NextResponse } from "next/server";
import { getMaintenanceMode } from "../../../lib/maintenanceSettings";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const maintenance = await getMaintenanceMode();
    return NextResponse.json(
      { success: true, data: { maintenance } },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch {
    // Fail open if the status lookup itself is unavailable. Individual APIs
    // still retain their own validation and availability protections.
    return NextResponse.json(
      { success: true, data: { maintenance: false } },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  }
}
