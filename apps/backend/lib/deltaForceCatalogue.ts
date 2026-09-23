import { prepareGameCatalogue } from "./mlbbCatalogue";

export type DeltaForceCategory = "pass" | "normal" | "other";

const DELTA_FORCE_ICON_ROOT = "/packages/delta-force";

function deltaCoinAmount(name: string) {
  const match = name.replace(/,/g, "").match(/\d+/);
  return match ? Number(match[0]) : 0;
}

export function getDeltaForceIconUrl(name: string) {
  const normalized = name.trim().toLowerCase();
  if (normalized.includes("monthly")) return `${DELTA_FORCE_ICON_ROOT}/monthly.png`;
  if (normalized.includes("weekly")) return `${DELTA_FORCE_ICON_ROOT}/weekly.png`;
  if (normalized.includes("pass")) return `${DELTA_FORCE_ICON_ROOT}/pass.png`;
  if (normalized.includes("crate") || normalized.includes("chest") || normalized.includes("supplies")) {
    return `${DELTA_FORCE_ICON_ROOT}/crate.png`;
  }
  if (normalized.includes("pack") || normalized.includes("bundle")) return `${DELTA_FORCE_ICON_ROOT}/pack.png`;

  const amount = deltaCoinAmount(normalized);
  if (amount <= 500) return `${DELTA_FORCE_ICON_ROOT}/delta-coins-small.png`;
  if (amount <= 2_000) return `${DELTA_FORCE_ICON_ROOT}/delta-coins-medium.png`;
  return `${DELTA_FORCE_ICON_ROOT}/delta-coins-large.png`;
}

export function getDeltaForceCategory(name: string): DeltaForceCategory {
  const normalized = name.trim().toLowerCase();
  if (normalized.includes("pass")) return "pass";
  if (/^\d+$/.test(normalized)) return "normal";
  return "other";
}

export function prepareDeltaForceCatalogue(items: unknown) {
  const categoryOrder: Record<DeltaForceCategory, number> = { pass: 0, normal: 1, other: 2 };
  return prepareGameCatalogue(items, "DELTA")
    .map((entry) => {
      const catalogCategory = getDeltaForceCategory(entry.catalogueName);
      return {
        ...entry,
        catalogCategory,
        product: {
          ...entry.product,
          name: catalogCategory === "normal" ? `${entry.catalogueName} Delta Coins` : entry.catalogueName,
          description: `Delta Force | ${catalogCategory}`,
          amount: entry.catalogueName,
          iconUrl: getDeltaForceIconUrl(entry.catalogueName),
          isPopular: catalogCategory === "pass",
          isFeatured: catalogCategory === "other",
        },
      };
    })
    .sort((a, b) => categoryOrder[a.catalogCategory] - categoryOrder[b.catalogCategory])
    .map((entry, sortOrder) => ({ ...entry, product: { ...entry.product, sortOrder } }));
}
