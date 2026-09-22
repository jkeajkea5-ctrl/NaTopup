export type FreeFireCategory = "pass" | "normal" | "other";

export function getFreeFireIconUrl(name: string, category = getFreeFireCategory(name)) {
  const normalized = name.toLowerCase().replace(/\s+/g, " ").trim();
  if (category === "normal") return "/packages/freefire/diamonds.png";
  if (normalized.includes("weeklylite") || normalized.includes("weekly lite") || normalized.includes("weekly lit")) return "/packages/freefire/weekly-lite.png";
  if (normalized.includes("weekly")) return "/packages/freefire/weekly.png";
  if (normalized.includes("monthly")) return "/packages/freefire/monthly.png";
  if (normalized.includes("level up")) return "/packages/freefire/level-up.png";
  if (normalized.includes("3 in 1")) return "/packages/freefire/three-in-one.jpg";
  return "/packages/freefire/diamonds.png";
}

export function getFreeFireCategory(name: string): FreeFireCategory {
  const normalized = name.toLowerCase();
  if (normalized.includes("weekly") || normalized.includes("monthly")) return "pass";
  if (/^\d+$/.test(normalized.trim())) return "normal";
  return "other";
}

export function prepareFreeFireCatalogue(items: unknown) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("Vizo FreeFire MY catalogue is empty; existing packages were not changed.");
  }

  const codes = new Set<string>();
  const categoryOrder: Record<FreeFireCategory, number> = { pass: 0, normal: 1, other: 2 };
  const prepared = items.map((item: any) => {
    const productCode = String(item?.product_code ?? "").trim();
    const name = String(item?.name ?? "").replace(/\u200b/g, "").trim();
    const supplierCost = Number(item?.sell_price);
    const isActive = String(item?.status ?? "active").toLowerCase() === "active";
    if (!productCode || !name || !Number.isFinite(supplierCost) || supplierCost <= 0 || !isActive || codes.has(productCode)) {
      throw new Error("Invalid, unavailable, or duplicate Vizo FreeFire MY product; existing packages were not changed.");
    }
    codes.add(productCode);

    const catalogCategory = getFreeFireCategory(name);
    const markupValue = Math.max(0.05, Math.round(supplierCost * 0.1 * 100) / 100);
    const displayName = catalogCategory === "normal" ? `${name} Diamonds` : name;
    return {
      catalogCategory,
      supplierProductCode: productCode,
      supplierProductName: name,
      product: {
        sku: `VIZO_${productCode.toUpperCase()}`,
        name: displayName,
        iconUrl: getFreeFireIconUrl(name, catalogCategory),
        description: `FreeFire MY | ${catalogCategory}`,
        amount: catalogCategory === "normal" ? name : "1 Package",
        isPopular: catalogCategory === "pass",
        isFeatured: catalogCategory === "other",
        isActive: true,
        sortOrder: 0,
      },
      price: {
        supplierCost,
        pricingStrategy: "FIXED_MARKUP",
        markupValue,
        sellingPrice: Math.round((supplierCost + markupValue) * 100) / 100,
        discount: 0,
        currency: "USD",
      },
    };
  });

  return prepared
    .sort((a, b) => categoryOrder[a.catalogCategory] - categoryOrder[b.catalogCategory])
    .map((entry, sortOrder) => ({ ...entry, product: { ...entry.product, sortOrder } }));
}
