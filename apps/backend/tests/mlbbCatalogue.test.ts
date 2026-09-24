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
  assert.equal(small.product.sku, "G2B_MLBB_1942");
  assert.equal(small.product.isPopular, false);
  assert.equal(small.product.iconUrl, "/packages/mlbb/diamonds.png");
  assert.equal(weekly.price.sellingPrice, 2.01);
  assert.equal(weekly.product.name, "Weekly Diamond Pass");
  assert.equal(weekly.product.iconUrl, "/packages/mlbb/weekly-pass.png");
  assert.equal(weekly.product.isPopular, true);
  assert.equal(weekly.supplierProductCode, "G2B_MLBB_Weekly");
  assert.equal(pack.product.name, "Weekly Elite Pack");
  assert.equal(pack.product.iconUrl, "/packages/mlbb/weekly-elite.png");
  assert.equal(pack.product.amount, "1 Pack");
  assert.equal(pack.product.isPopular, false);
});

test("uses only the requested passes and elite packs for Best Selling", () => {
  const entries = prepareMlbbCatalogue([
    { id: 1, name: "85", amount: 1.448 },
    { id: 2, name: "Weekly Elite Pack", amount: 0.938 },
    { id: 3, name: "Weekly", amount: 1.826 },
    { id: 4, name: "Monthly Elite Pack", amount: 4.682 },
    { id: 5, name: "Twilight", amount: 9.425 },
    { id: 6, name: "875", amount: 14.494 },
  ]);

  assert.deepEqual(
    entries.filter((entry) => entry.product.isPopular).map((entry) => entry.catalogueName),
    ["Weekly", "Monthly Elite Pack", "Twilight"]
  );
  assert.equal(entries.find((entry) => entry.catalogueName === "85")?.product.isPopular, false);
  assert.equal(entries.find((entry) => entry.catalogueName === "875")?.product.isPopular, false);
  assert.equal(entries.find((entry) => entry.catalogueName === "Monthly Elite Pack")?.product.iconUrl, "/packages/mlbb/monthly-elite.png");
  assert.equal(entries.find((entry) => entry.catalogueName === "Twilight")?.product.iconUrl, "/packages/mlbb/twilight-pass.png");
  assert.ok(entries.every((entry) => entry.product.description.startsWith("MLBB (")));
});
