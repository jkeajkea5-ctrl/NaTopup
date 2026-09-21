import test from "node:test";
import assert from "node:assert/strict";
import { prepareMlbbCatalogue } from "../lib/mlbbCatalogue";

test("rejects empty, malformed and duplicate catalogues before replacement", () => {
  for (const items of [null, [], [{ id: 1, name: "5", amount: 0 }], [{ id: 1, name: "5", amount: "bad" }], [{ id: 1, amount: 1 }], [{ id: 1, name: "5", amount: 1 }, { id: 1, name: "12", amount: 2 }], [{ id: 1, name: "5", amount: 1 }, { id: 2, name: "5", amount: 1 }]]) {
    assert.throws(() => prepareMlbbCatalogue(items));
  }
});

test("preserves supplier names and prices with the existing markup", () => {
  const [small, weekly, pack] = prepareMlbbCatalogue([
    { id: 1942, name: "5", amount: 0.092 },
    { id: 1941, name: "Weekly", amount: "1.826" },
    { id: 5917, name: "Weekly Elite Pack", amount: 0.938 },
  ]);
  assert.equal(small.price.sellingPrice, 0.14);
  assert.equal(small.product.sku, "G2B_MLBB_GLOBAL_1942");
  assert.equal(small.product.isPopular, false);
  assert.equal(weekly.price.sellingPrice, 2.01);
  assert.equal(weekly.product.name, "Weekly Diamond Pass");
  assert.equal(weekly.product.isPopular, true);
  assert.equal(weekly.supplierProductCode, "G2B_MLBB_Weekly");
  assert.equal(pack.product.name, "Weekly Elite Pack");
  assert.equal(pack.product.amount, "1 Pack");
});
