import assert from "node:assert/strict";
import test from "node:test";
import { adminMutation, importCostFloorMessage, isCostBelowImportCost } from "../lib/adminValidation";

test("enforces the imported supplier cost with three-decimal precision", () => {
  assert.equal(isCostBelowImportCost(0.762, 0.763), true);
  assert.equal(isCostBelowImportCost(0.763, 0.763), false);
  assert.equal(isCostBelowImportCost(0.764, 0.763), false);
  assert.equal(isCostBelowImportCost(0, null), false);
  assert.equal(
    importCostFloorMessage(0.763, "G2BULK"),
    "Cost price cannot be below the imported cost of $0.763 from G2BULK."
  );
});

test("continues to reject a customer price below cost", () => {
  const base = {
    entity: "package" as const,
    id: "a".repeat(24),
    data: {
      iconUrl: "",
      name: "Test package",
      amount: "10",
      customBadge: "",
      category: "normal" as const,
      sortOrder: 0,
      isActive: true,
      supplierCost: 0.763,
      sellingPrice: 0.77,
      discount: 0,
    },
  };
  assert.equal(adminMutation.safeParse(base).success, true);
  assert.equal(adminMutation.safeParse({
    ...base,
    data: { ...base.data, sellingPrice: 0.76 },
  }).success, false);
});
