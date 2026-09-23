import test from "node:test";
import assert from "node:assert/strict";
import { getHokCategory, getHokIconUrl, prepareHokCatalogue } from "../lib/hokCatalogue";

test("classifies Honor of Kings products into Pass, Normal, and Other", () => {
  assert.equal(getHokCategory("Weekly Card"), "pass");
  assert.equal(getHokCategory("Weekly Card Plus"), "pass");
  assert.equal(getHokCategory("830"), "normal");
  assert.equal(getHokCategory("Double Token Lucky Bag"), "other");
  assert.equal(getHokCategory("Honor Point Value Pack"), "other");
});

test("prepares HOK token labels and storefront flags", () => {
  const entries = prepareHokCatalogue([
    { id: 1, name: "Weekly Card", amount: 0.949 },
    { id: 2, name: "80", amount: 0.847 },
    { id: 3, name: "Double Token Lucky Bag", amount: 0.265 },
  ]);

  assert.deepEqual(entries.map((entry) => entry.catalogCategory), ["pass", "normal", "other"]);
  assert.equal(entries[0].product.isPopular, true);
  assert.equal(entries[1].product.name, "80 Tokens");
  assert.equal(entries[1].product.isFeatured, false);
  assert.equal(entries[2].product.isFeatured, true);
  assert.ok(entries.every((entry) => entry.product.description.startsWith("Honor of Kings | ")));
});

test("maps HOK package artwork, including a distinct Weekly Card Plus icon", () => {
  assert.equal(getHokIconUrl("Weekly Card"), "/packages/hok/weekly.webp");
  assert.equal(getHokIconUrl("Weekly Card Plus"), "/packages/hok/weekly-plus.webp");
  assert.equal(getHokIconUrl("Double Token Lucky Bag"), "/packages/hok/lucky-bag.webp");
  assert.equal(getHokIconUrl("Standard Purchase Rebate Pack"), "/packages/hok/purchase-rebate-pack.webp");
  assert.equal(getHokIconUrl("Honor Point Value Pack"), "/packages/hok/honor-point-value-pack.webp");
  assert.equal(getHokIconUrl("80"), "/packages/hok/tokens.webp");
});
