import { prepareGameCatalogue } from "./mlbbCatalogue";

export type BloodStrikeCategory = "pass" | "normal" | "other";

export function getBloodStrikeCategory(name: string): BloodStrikeCategory {
  const normalized = name.trim().toLowerCase();
  if (normalized.includes("pass")) return "pass";
  if (/^\d+$/.test(normalized)) return "normal";
  return "other";
}

function getDisplayName(name: string, category: BloodStrikeCategory): string {
  if (category === "normal") return `${name} Gold`;
  const deal = name.match(/^(\d{3})deal$/i);
  if (deal) return `$${(Number(deal[1]) / 100).toFixed(2)} Deal`;
  return name;
}

export function prepareBloodStrikeCatalogue(items: unknown) {
  const categoryOrder: Record<BloodStrikeCategory, number> = { pass: 0, normal: 1, other: 2 };
  return prepareGameCatalogue(items, "BLOODSTRIKE")
    .map((entry) => {
      const catalogCategory = getBloodStrikeCategory(entry.catalogueName);
      return {
        ...entry,
        catalogCategory,
        product: {
          ...entry.product,
          name: getDisplayName(entry.catalogueName, catalogCategory),
          description: `Blood Strike | ${catalogCategory}`,
          amount: entry.catalogueName,
          isPopular: catalogCategory === "pass",
          isFeatured: catalogCategory === "other",
        },
      };
    })
    .sort((a, b) => categoryOrder[a.catalogCategory] - categoryOrder[b.catalogCategory])
    .map((entry, sortOrder) => ({ ...entry, product: { ...entry.product, sortOrder } }));
}
