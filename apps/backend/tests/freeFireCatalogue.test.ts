import test from "node:test";
import assert from "node:assert/strict";
import { getFreeFireCategory, prepareFreeFireCatalogue } from "../lib/freeFireCatalogue";

test("classifies FreeFire MY products into Pass, Normal, and Other", () => {
  assert.equal(getFreeFireCategory("Weekly Lit x3"), "pass");
  assert.equal(getFreeFireCategory("Monthly Membership"), "pass");
  assert.equal(getFreeFireCategory("520"), "normal");
  assert.equal(getFreeFireCategory("Level Up Package - Level 10"), "other");
  assert.equal(getFreeFireCategory("3 in 1"), "other");
});

test("prepares Vizo codes, prices, and storefront category flags", () => {
  const entries = prepareFreeFireCatalogue([
    { product_code: "freefire_sgmy_weekly", name: "Weekly", sell_price: 1.54, status: "active" },
    { product_code: "freefire_sgmy_100", name: "100", sell_price: 0.89, status: "active" },
    { product_code: "freefire_sgmy_level_10", name: "Level Up Package - Level 10", sell_price: 0.6, status: "active" },
  ]);

  assert.deepEqual(entries.map((entry) => entry.catalogCategory), ["pass", "normal", "other"]);
  assert.equal(entries[0].product.isPopular, true);
  assert.equal(entries[1].product.name, "100 Diamonds");
  assert.equal(entries[1].product.isPopular, false);
  assert.equal(entries[1].product.isFeatured, false);
  assert.equal(entries[2].product.isFeatured, true);
  assert.equal(entries[0].price.sellingPrice, 1.69);
  assert.equal(entries[0].supplierProductCode, "freefire_sgmy_weekly");
});

test("rejects empty, duplicate, inactive, and invalid Vizo products", () => {
  assert.throws(() => prepareFreeFireCatalogue([]));
  assert.throws(() => prepareFreeFireCatalogue([{ product_code: "x", name: "25", sell_price: 0, status: "active" }]));
  assert.throws(() => prepareFreeFireCatalogue([{ product_code: "x", name: "25", sell_price: 1, status: "inactive" }]));
  assert.throws(() => prepareFreeFireCatalogue([
    { product_code: "x", name: "25", sell_price: 1, status: "active" },
    { product_code: "x", name: "100", sell_price: 2, status: "active" },
  ]));
});
