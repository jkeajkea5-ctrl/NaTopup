import { prepareGameCatalogue } from "./mlbbCatalogue";

export type PubgCategory = "pass" | "normal" | "other";

export function getPubgCategory(name: string): PubgCategory {
  const normalized = name.trim().toLowerCase();
  if (normalized.includes("prime") || normalized.includes("elite pass")) return "pass";
  if (/^\d+$/.test(normalized)) return "normal";
  return "other";
}

export function preparePubgCatalogue(items: unknown) {
  const categoryOrder: Record<PubgCategory, number> = { pass: 0, normal: 1, other: 2 };
  return prepareGameCatalogue(items, "PUBGM")
    .map((entry) => {
      const catalogCategory = getPubgCategory(entry.catalogueName);
      const isNumericUc = catalogCategory === "normal";
      return {
        ...entry,
        catalogCategory,
        product: {
          ...entry.product,
          name: isNumericUc ? `${entry.catalogueName} UC` : entry.catalogueName,
          description: `PUBG Mobile | ${catalogCategory}`,
          amount: entry.catalogueName,
          isPopular: catalogCategory === "pass",
          isFeatured: catalogCategory === "other",
        },
      };
    })
    .sort((a, b) => categoryOrder[a.catalogCategory] - categoryOrder[b.catalogCategory])
    .map((entry, sortOrder) => ({ ...entry, product: { ...entry.product, sortOrder } }));
}
