import { prepareGameCatalogue } from "./mlbbCatalogue";

export type HokCategory = "pass" | "normal" | "other";

export function getHokCategory(name: string): HokCategory {
  const normalized = name.trim().toLowerCase();
  if (normalized.includes("weekly card")) return "pass";
  if (/^\d+$/.test(normalized)) return "normal";
  return "other";
}

export function getHokIconUrl(name: string) {
  const normalized = name.trim().toLowerCase();
  if (normalized.includes("weekly card plus")) return "/packages/hok/weekly-plus.webp";
  if (normalized.includes("weekly")) return "/packages/hok/weekly.webp";
  if (normalized.includes("monthly")) return "/packages/hok/monthly.webp";
  if (normalized.includes("lucky")) return "/packages/hok/lucky-bag.webp";
  if (normalized.includes("rebate") || normalized.includes("purchase")) return "/packages/hok/purchase-rebate-pack.webp";
  if (normalized.includes("skin") || normalized.includes("special")) return "/packages/hok/skin-special-item.webp";
  if (normalized.includes("honor point") || normalized.includes("value pack")) return "/packages/hok/honor-point-value-pack.webp";
  return "/packages/hok/tokens.webp";
}

export function prepareHokCatalogue(items: unknown) {
  const categoryOrder: Record<HokCategory, number> = { pass: 0, normal: 1, other: 2 };
  return prepareGameCatalogue(items, "HOK")
    .map((entry) => {
      const catalogCategory = getHokCategory(entry.catalogueName);
      return {
        ...entry,
        catalogCategory,
        product: {
          ...entry.product,
          iconUrl: getHokIconUrl(entry.catalogueName),
          name: catalogCategory === "normal" ? `${entry.catalogueName} Tokens` : entry.catalogueName,
          description: `Honor of Kings | ${catalogCategory}`,
          amount: entry.catalogueName,
          isPopular: catalogCategory === "pass",
          isFeatured: catalogCategory === "other",
        },
      };
    })
    .sort((a, b) => categoryOrder[a.catalogCategory] - categoryOrder[b.catalogCategory])
    .map((entry, sortOrder) => ({ ...entry, product: { ...entry.product, sortOrder } }));
}
