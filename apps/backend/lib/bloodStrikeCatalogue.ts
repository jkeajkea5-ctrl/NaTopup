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

export function getBloodStrikeIconUrl(name: string) {
  const normalized = name.trim().toLowerCase();
  if (normalized.includes("upgrade point")) return "/packages/blood-strike/upgrade-point.webp";
  if (normalized.includes("level up pass")) return "/packages/blood-strike/level-up-pass.webp";
  if (normalized.includes("strike pass premium")) return "/packages/blood-strike/premium.webp";
  if (normalized.includes("strike pass elite")) return "/packages/blood-strike/strike-pass-elite.webp";
  if (normalized.includes("voucher")) return "/packages/blood-strike/voucher.webp";
  if (normalized.includes("lucky chest") || normalized.includes("lucky bag")) return "/packages/blood-strike/lucky-chest.webp";
  if (/^\d+$/.test(normalized)) return "/packages/blood-strike/gold.webp";
  if (/^\d{3}deal$/.test(normalized) || normalized.includes("deal")) return "/packages/blood-strike/deal.webp";
  return "/packages/blood-strike/other.webp";
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
          iconUrl: getBloodStrikeIconUrl(entry.catalogueName),
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
