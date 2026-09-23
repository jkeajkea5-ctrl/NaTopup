const MAGIC_CHESS_ICON_ROOT = "/packages/magic-chess-gogo";

export const MAGIC_CHESS_DIAMONDS_ICON = `${MAGIC_CHESS_ICON_ROOT}/diamonds.png`;
export const MAGIC_CHESS_WEEKLY_CARD_ICON = `${MAGIC_CHESS_ICON_ROOT}/weekly-card.png`;

export function getMagicChessGogoIconUrl(name: string) {
  const normalized = name.trim().toLowerCase();
  return normalized.includes("weekly") || normalized.includes("card")
    ? MAGIC_CHESS_WEEKLY_CARD_ICON
    : MAGIC_CHESS_DIAMONDS_ICON;
}
