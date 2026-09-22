import test from "node:test";
import assert from "node:assert/strict";
import { getPubgCategory, preparePubgCatalogue } from "../lib/pubgCatalogue";

test("classifies PUBG packages into Pass, Normal, and Other", () => {
  assert.equal(getPubgCategory("Prime (1 Month)"), "pass");
  assert.equal(getPubgCategory("Prime Plus (12 Months)"), "pass");
  assert.equal(getPubgCategory("Elite Pass LV1-100"), "pass");
  assert.equal(getPubgCategory("660"), "normal");
  assert.equal(getPubgCategory("Weekly Deal Pack 1"), "other");
  assert.equal(getPubgCategory("660 WOW Coins"), "other");
  assert.equal(getPubgCategory("1800 UC (discounted)"), "other");
});

test("prepares PUBG labels and storefront category flags", () => {
  const entries = preparePubgCatalogue([
    { id: 1, name: "Prime (1 Month)", amount: 0.89 },
    { id: 2, name: "60", amount: 0.92 },
    { id: 3, name: "60 WOW Coins", amount: 0.95 },
  ]);

  assert.deepEqual(entries.map((entry) => entry.catalogCategory), ["pass", "normal", "other"]);
  assert.equal(entries[0].product.isPopular, true);
  assert.equal(entries[1].product.name, "60 UC");
  assert.equal(entries[1].product.isPopular, false);
  assert.equal(entries[1].product.isFeatured, false);
  assert.equal(entries[2].product.isFeatured, true);
  assert.ok(entries.every((entry) => entry.product.description.startsWith("PUBG Mobile | ")));
});
