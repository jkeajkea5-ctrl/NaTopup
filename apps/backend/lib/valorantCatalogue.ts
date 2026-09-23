import { prepareGameCatalogue } from "./mlbbCatalogue";

export const VALORANT_POINTS_ICON = "/packages/valorant/points.webp";

export function prepareValorantCatalogue(items: unknown) {
  return prepareGameCatalogue(items, "VAL", ["1000", "5350"]).map((entry) => ({
    ...entry,
    product: {
      ...entry.product,
      name: `${entry.catalogueName} Valorant Points`,
      description: `Valorant Cambodia Server (${entry.catalogueName} VP)`,
      iconUrl: VALORANT_POINTS_ICON,
    },
  }));
}
