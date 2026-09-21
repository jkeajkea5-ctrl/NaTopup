import { PricingStrategy } from "./enums";

export interface PricingInput {
  supplierCost: number;
  strategy: PricingStrategy;
  markupValue: number; // e.g. 0.50 ($0.50 fixed) or 10 (10% percentage)
  manualPrice?: number;
  discount?: number; // e.g. 0.20 ($0.20 off)
  minMarginPercent?: number; // default e.g. 5%
  exchangeRateUsdToKhr?: number; // default 4100
}

export interface PricingResult {
  supplierCost: number;
  markup: number;
  calculatedPrice: number;
  discount: number;
  finalPriceUsd: number;
  finalPriceKhr: number;
  profitUsd: number;
  profitMarginPercent: number;
}

/**
 * Rounds a number to exactly two decimal places (cents) safely.
 */
export function roundCurrency(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

/**
 * Calculates customer selling price and margin based on configured strategy.
 */
export function calculateCustomerPrice(input: PricingInput): PricingResult {
  const {
    supplierCost,
    strategy,
    markupValue,
    manualPrice,
    discount = 0,
    minMarginPercent = 5,
    exchangeRateUsdToKhr = 4100,
  } = input;

  let baseSellingPrice = 0;
  let markup = 0;

  switch (strategy) {
    case PricingStrategy.MANUAL:
      if (manualPrice !== undefined && manualPrice > 0) {
        baseSellingPrice = manualPrice;
        markup = roundCurrency(manualPrice - supplierCost);
      } else {
        markup = markupValue;
        baseSellingPrice = roundCurrency(supplierCost + markup);
      }
      break;

    case PricingStrategy.PERCENTAGE_MARKUP:
      // markupValue is percentage, e.g., 10 means 10%
      markup = roundCurrency(supplierCost * (markupValue / 100));
      baseSellingPrice = roundCurrency(supplierCost + markup);
      break;

    case PricingStrategy.MINIMUM_MARGIN:
      // ensure at least minMarginPercent or markupValue
      const effectiveMarginPercent = Math.max(minMarginPercent, markupValue);
      markup = roundCurrency(supplierCost * (effectiveMarginPercent / 100));
      baseSellingPrice = roundCurrency(supplierCost + markup);
      break;

    case PricingStrategy.FIXED_MARKUP:
    default:
      markup = roundCurrency(markupValue);
      baseSellingPrice = roundCurrency(supplierCost + markup);
      break;
  }

  // Apply discount
  const finalPriceUsd = Math.max(0.01, roundCurrency(baseSellingPrice - discount));
  const profitUsd = roundCurrency(finalPriceUsd - supplierCost);
  const profitMarginPercent = supplierCost > 0
    ? roundCurrency((profitUsd / supplierCost) * 100)
    : 100;

  // KHR rounded to nearest 100 Riels (Cambodian currency standard)
  const rawKhr = finalPriceUsd * exchangeRateUsdToKhr;
  const finalPriceKhr = Math.ceil(rawKhr / 100) * 100;

  return {
    supplierCost: roundCurrency(supplierCost),
    markup,
    calculatedPrice: baseSellingPrice,
    discount: roundCurrency(discount),
    finalPriceUsd,
    finalPriceKhr,
    profitUsd,
    profitMarginPercent,
  };
}

/**
 * Validates whether the current supplier price is safe to proceed without review.
 * @param expectedSupplierCost The cost recorded when the order was created
 * @param currentSupplierCost The current real-time cost from the supplier API
 * @param maxSurgePercent The maximum allowed surge percentage (e.g. 5%)
 */
export function isSupplierPriceSafe(
  expectedSupplierCost: number,
  currentSupplierCost: number,
  maxSurgePercent: number = 5.0
): { safe: boolean; diffPercent: number; reason?: string } {
  if (currentSupplierCost <= expectedSupplierCost) {
    return { safe: true, diffPercent: 0 };
  }

  const diff = currentSupplierCost - expectedSupplierCost;
  const surgePercent = (diff / expectedSupplierCost) * 100;

  if (surgePercent > maxSurgePercent) {
    return {
      safe: false,
      diffPercent: roundCurrency(surgePercent),
      reason: `Supplier cost surged by ${roundCurrency(surgePercent)}% (from $${expectedSupplierCost.toFixed(2)} to $${currentSupplierCost.toFixed(2)}), exceeding allowed threshold of ${maxSurgePercent}%.`,
    };
  }

  return { safe: true, diffPercent: roundCurrency(surgePercent) };
}
