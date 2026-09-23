import { prepareGameCatalogue } from "./mlbbCatalogue";

export const CROSSFIRE_CREDITS_ICON = "/packages/crossfire-legend/credits.webp";
export const CROSSFIRE_DIARY_ICON = "/packages/crossfire-legend/yun-youyous-diary.webp";

export function getCrossfireLegendIconUrl(name: string) {
  return name.trim().toLowerCase().includes("diary")
    ? CROSSFIRE_DIARY_ICON
    : CROSSFIRE_CREDITS_ICON;
}

export function prepareCrossfireLegendCatalogue(items: unknown) {
  return prepareGameCatalogue(items, "CROSSFIRE", ["120", "300", "680", "1280", "1980", "3280", "4500", "6480"])
    .map((entry) => ({
      ...entry,
      product: {
        ...entry.product,
        name: entry.catalogueName,
        amount: entry.catalogueName,
        description: `Crossfire: Legend Cambodia Server (${entry.catalogueName})`,
        iconUrl: getCrossfireLegendIconUrl(entry.catalogueName),
      },
    }));
}
