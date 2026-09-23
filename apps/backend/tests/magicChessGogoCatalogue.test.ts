import assert from "node:assert/strict";
import test from "node:test";
import {
  MAGIC_CHESS_DIAMONDS_ICON,
  MAGIC_CHESS_WEEKLY_CARD_ICON,
  getMagicChessGogoIconUrl,
} from "../lib/magicChessGogoCatalogue";

test("maps Magic Chess Gogo packages to diamond and weekly-card icons", () => {
  assert.equal(getMagicChessGogoIconUrl("86"), MAGIC_CHESS_DIAMONDS_ICON);
  assert.equal(getMagicChessGogoIconUrl("706 Diamonds"), MAGIC_CHESS_DIAMONDS_ICON);
  assert.equal(getMagicChessGogoIconUrl("Weekly Card"), MAGIC_CHESS_WEEKLY_CARD_ICON);
});
