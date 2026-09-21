import assert from "node:assert";
import test from "node:test";
import { calculateCustomerPrice, isSupplierPriceSafe, roundCurrency } from "../../packages/shared/dist/pricing.js";
import { PricingStrategy } from "../../packages/shared/dist/enums.js";

test("roundCurrency rounds safely to 2 decimals", () => {
  assert.strictEqual(roundCurrency(1.254), 1.25);
  assert.strictEqual(roundCurrency(1.256), 1.26);
});

test("Fixed markup pricing strategy calculation", () => {
  const result = calculateCustomerPrice({
    supplierCost: 4.50,
    strategy: PricingStrategy.FIXED_MARKUP,
    markupValue: 0.50,
  });

  assert.strictEqual(result.supplierCost, 4.50);
  assert.strictEqual(result.markup, 0.50);
  assert.strictEqual(result.finalPriceUsd, 5.00);
  assert.strictEqual(result.profitUsd, 0.50);
  assert.strictEqual(result.finalPriceKhr, 20500); // 5.00 * 4100 = 20500
});

test("Percentage markup pricing strategy calculation", () => {
  const result = calculateCustomerPrice({
    supplierCost: 10.00,
    strategy: PricingStrategy.PERCENTAGE_MARKUP,
    markupValue: 10, // 10%
  });

  assert.strictEqual(result.markup, 1.00);
  assert.strictEqual(result.finalPriceUsd, 11.00);
  assert.strictEqual(result.profitUsd, 1.00);
});

test("Price protection blocks surge exceeding maximum threshold", () => {
  const safe = isSupplierPriceSafe(10.00, 10.40, 5.0); // 4% surge <= 5%
  assert.strictEqual(safe.safe, true);

  const surge = isSupplierPriceSafe(10.00, 11.50, 5.0); // 15% surge > 5%
  assert.strictEqual(surge.safe, false);
  assert.ok(surge.diffPercent > 5);
});
