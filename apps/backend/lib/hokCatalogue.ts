import { prepareGameCatalogue } from "./mlbbCatalogue";

export type HokCategory = "pass" | "normal" | "other";

export function getHokCategory(name: string): HokCategory {
  const normalized = name.trim().toLowerCase();
  if (normalized.includes("weekly card")) return "pass";
  if (/^\d+$/.test(normalized)) return "normal";
  return "other";
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
