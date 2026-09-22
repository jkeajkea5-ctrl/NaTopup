import test from "node:test";
import assert from "node:assert/strict";
import { getDeltaForceCategory, prepareDeltaForceCatalogue } from "../lib/deltaForceCatalogue";

test("classifies Delta Force products into Pass, Normal, and Other", () => {
  assert.equal(getDeltaForceCategory("Season Pass Warfare Special"), "pass");
  assert.equal(getDeltaForceCategory("Pass Upgrade Level 80"), "pass");
  assert.equal(getDeltaForceCategory("1480"), "normal");
  assert.equal(getDeltaForceCategory("Reorientation Supplies"), "other");
});

test("prepares Delta Coin labels and storefront flags", () => {
  const entries = prepareDeltaForceCatalogue([
    { id: 1, name: "Season Pass Warfare Special", amount: 1.5 },
    { id: 2, name: "320", amount: 2.5 },
    { id: 3, name: "Reorientation Supplies", amount: 0.5 },
  ]);

  assert.deepEqual(entries.map((entry) => entry.catalogCategory), ["pass", "normal", "other"]);
  assert.equal(entries[0].product.isPopular, true);
  assert.equal(entries[1].product.name, "320 Delta Coins");
  assert.equal(entries[1].product.isFeatured, false);
  assert.equal(entries[2].product.isFeatured, true);
  assert.ok(entries.every((entry) => entry.product.description.startsWith("Delta Force | ")));
});
