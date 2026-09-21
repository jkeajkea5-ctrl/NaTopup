export function prepareMlbbCatalogue(items: unknown) {
  return prepareGameCatalogue(items, "MLBB", ["85", "Weekly", "275", "875"]);
}

export function prepareGameCatalogue(items: unknown, prefix: string, popularNames: string[] = []) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("MLBB Global catalogue is empty; existing packages were not changed.");
  }
  const ids = new Set<string>();
  const names = new Set<string>();
  return items.map((item, sortOrder) => {
    const id = String(item?.id ?? "").trim();
    const catalogueName = String(item?.name ?? "").trim();
    const supplierCost = Number(item?.amount);
    if (!id || !catalogueName || !Number.isFinite(supplierCost) || supplierCost <= 0 || ids.has(id) || names.has(catalogueName)) {
      throw new Error("Invalid or duplicate MLBB Global catalogue entry; existing packages were not changed.");
    }
    ids.add(id);
    names.add(catalogueName);
    const markupValue = Math.max(0.05, Math.round(supplierCost * 0.1 * 100) / 100);
    const pass = catalogueName === "Weekly" || catalogueName === "Twilight";
    const pack = /pack/i.test(catalogueName);
    return {
      catalogueName,
      supplierProductCode: `G2B_${prefix}_${catalogueName}`,
      product: {
        sku: `G2B_MLBB_GLOBAL_${id}`,
        name: catalogueName === "Weekly" ? "Weekly Diamond Pass" : catalogueName === "Twilight" ? "Twilight Pass" : pack ? catalogueName : `${catalogueName} Diamonds`,
        description: `MLBB Global Server (${catalogueName})`,
        amount: pass ? "1 Pass" : pack ? "1 Pack" : catalogueName,
        isPopular: popularNames.includes(catalogueName),
        isFeatured: catalogueName === "Weekly",
        isActive: true,
        sortOrder,
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
}
