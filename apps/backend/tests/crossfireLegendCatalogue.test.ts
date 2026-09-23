import test from "node:test";
import assert from "node:assert/strict";
import {
  CROSSFIRE_CREDITS_ICON,
  CROSSFIRE_DIARY_ICON,
  getCrossfireLegendIconUrl,
  prepareCrossfireLegendCatalogue,
} from "../lib/crossfireLegendCatalogue";

test("maps numeric Crossfire packages to Credits and diary packages to Diary artwork", () => {
  assert.equal(getCrossfireLegendIconUrl("680"), CROSSFIRE_CREDITS_ICON);
  assert.equal(getCrossfireLegendIconUrl("Yun Youyou's Diary x15"), CROSSFIRE_DIARY_ICON);
  assert.equal(getCrossfireLegendIconUrl("  SPECIAL DIARY  "), CROSSFIRE_DIARY_ICON);
});

test("prepares Crossfire packages with storefront labels and artwork", () => {
  const entries = prepareCrossfireLegendCatalogue([
    { id: 1, name: "30", amount: 0.5 },
    { id: 2, name: "Yun Youyou's Diary x1", amount: 1.25 },
  ]);

  assert.equal(entries[0].product.name, "30");
  assert.equal(entries[0].product.amount, "30");
  assert.equal(entries[0].product.iconUrl, CROSSFIRE_CREDITS_ICON);
  assert.equal(entries[1].product.iconUrl, CROSSFIRE_DIARY_ICON);
  assert.ok(entries.every((entry) => entry.product.description.startsWith("Crossfire: Legend Cambodia Server")));
});
