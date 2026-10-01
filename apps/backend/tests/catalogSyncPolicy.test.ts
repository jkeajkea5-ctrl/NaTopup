import assert from "node:assert/strict";
import test from "node:test";
import { supplierCostSyncData, syncedPackageActiveState } from "../services/CatalogSyncService";

test("catalog sync never activates a package hidden by an administrator", () => {
  assert.equal(syncedPackageActiveState(false, true), false);
  assert.equal(syncedPackageActiveState(false, false), false);
  assert.equal(syncedPackageActiveState(true, true), true);
  assert.equal(syncedPackageActiveState(true, false), false);
});

test("catalog sync updates only the original supplier cost", () => {
  const update = supplierCostSyncData(1.234);

  assert.deepEqual(update, { supplierCost: 1.234 });
  assert.equal("sellingPrice" in update, false);
  assert.equal("discount" in update, false);
});
