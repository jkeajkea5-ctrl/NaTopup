import test from "node:test";
import assert from "node:assert/strict";
import { getBloodStrikeCategory, getBloodStrikeIconUrl, prepareBloodStrikeCatalogue } from "../lib/bloodStrikeCatalogue";

test("classifies Blood Strike products into Pass, Normal, and Other", () => {
  assert.equal(getBloodStrikeCategory("Level Up Pass"), "pass");
  assert.equal(getBloodStrikeCategory("Strike Pass Elite"), "pass");
  assert.equal(getBloodStrikeCategory("540"), "normal");
  assert.equal(getBloodStrikeCategory("Ultra Skin Lucky Chest"), "other");
  assert.equal(getBloodStrikeCategory("049deal"), "other");
});

test("prepares Gold and deal labels with storefront flags", () => {
  const entries = prepareBloodStrikeCatalogue([
    { id: 1, name: "Strike Pass Elite", amount: 1.5 },
    { id: 2, name: "320", amount: 2.5 },
    { id: 3, name: "049deal", amount: 0.45 },
  ]);

  assert.deepEqual(entries.map((entry) => entry.catalogCategory), ["pass", "normal", "other"]);
  assert.equal(entries[0].product.isPopular, true);
  assert.equal(entries[1].product.name, "320 Gold");
  assert.equal(entries[2].product.name, "$0.49 Deal");
  assert.equal(entries[2].catalogueName, "049deal");
  assert.equal(entries[2].product.isFeatured, true);
  assert.ok(entries.every((entry) => entry.product.description.startsWith("Blood Strike | ")));
});

test("maps Blood Strike packages to their artwork groups", () => {
  assert.equal(getBloodStrikeIconUrl("Level Up Pass"), "/packages/blood-strike/level-up-pass.webp");
  assert.equal(getBloodStrikeIconUrl("Strike Pass Elite"), "/packages/blood-strike/strike-pass-elite.webp");
  assert.equal(getBloodStrikeIconUrl("Strike Pass Premium"), "/packages/blood-strike/premium.webp");
  assert.equal(getBloodStrikeIconUrl("5800"), "/packages/blood-strike/gold.webp");
  assert.equal(getBloodStrikeIconUrl("Ultra Skin Lucky Chest"), "/packages/blood-strike/lucky-chest.webp");
  assert.equal(getBloodStrikeIconUrl("Featured Lucha Strike Stash Voucher"), "/packages/blood-strike/voucher.webp");
  assert.equal(getBloodStrikeIconUrl("Lucha Strike Upgrade Point Chest"), "/packages/blood-strike/upgrade-point.webp");
  assert.equal(getBloodStrikeIconUrl("499deal"), "/packages/blood-strike/deal.webp");
  assert.equal(getBloodStrikeIconUrl("Unknown Bundle"), "/packages/blood-strike/other.webp");
});
