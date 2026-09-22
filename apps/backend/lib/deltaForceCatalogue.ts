import { prepareGameCatalogue } from "./mlbbCatalogue";

export type DeltaForceCategory = "pass" | "normal" | "other";

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
          isPopular: catalogCategory === "pass",
          isFeatured: catalogCategory === "other",
        },
      };
    })
    .sort((a, b) => categoryOrder[a.catalogCategory] - categoryOrder[b.catalogCategory])
    .map((entry, sortOrder) => ({ ...entry, product: { ...entry.product, sortOrder } }));
}
