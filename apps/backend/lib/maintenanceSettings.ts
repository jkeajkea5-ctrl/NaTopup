import { prisma } from "./prisma";

const MAINTENANCE_MODE_KEY = "MAINTENANCE_MODE";

export function parseMaintenanceMode(value?: string | null): boolean {
  if (!value) return false;
  try {
    return JSON.parse(value) === true;
  } catch {
    return value.trim().toLowerCase() === "true";
  }
}

export async function getMaintenanceMode(): Promise<boolean> {
  const setting = await prisma.appSetting.findUnique({
    where: { key: MAINTENANCE_MODE_KEY },
    select: { value: true },
  });
  return parseMaintenanceMode(setting?.value);
}

export async function saveMaintenanceMode(enabled: boolean): Promise<boolean> {
  await prisma.appSetting.upsert({
    where: { key: MAINTENANCE_MODE_KEY },
    update: { value: JSON.stringify(enabled), type: "boolean" },
    create: { key: MAINTENANCE_MODE_KEY, value: JSON.stringify(enabled), type: "boolean" },
  });
  return getMaintenanceMode();
}
