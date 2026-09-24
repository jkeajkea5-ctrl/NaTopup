export function getMlbbIconUrl(name: string) {
  const normalized = name.trim().toLowerCase();
  if (normalized === "weekly elite pack") return "/packages/mlbb/weekly-elite.png";
  if (normalized === "weekly" || normalized === "weekly diamond pass") return "/packages/mlbb/weekly-pass.png";
  if (normalized === "monthly elite pack") return "/packages/mlbb/monthly-elite.png";
  if (normalized === "twilight" || normalized === "twilight pass") return "/packages/mlbb/twilight-pass.png";
  return "/packages/mlbb/diamonds.png";
}

export function prepareMlbbCatalogue(items: unknown) {
  return prepareGameCatalogue(items, "MLBB", [
    "Weekly Elite Pack",
    "Weekly",
    "Monthly Elite Pack",
    "Twilight",
  ]);
}

export function prepareMlbbExclusiveCatalogue(items: unknown) {
  return prepareGameCatalogue(items, "MLBB_EXCLUSIVE", [
    "Weekly Elite Pack",
    "Weekly",
    "Monthly Elite Pack",
    "Twilight",
  ]);
}

export function prepareGameCatalogue(items: unknown, prefix: string, popularNames: string[] = []) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("Supplier catalogue is empty; existing packages were not changed.");
  }
  const ids = new Set<string>();
  const names = new Set<string>();
  return items.map((item, sortOrder) => {
    const id = String(item?.id ?? "").trim();
    const catalogueName = String(item?.name ?? "").trim();
    const supplierCost = Number(item?.amount);
    if (!id || !catalogueName || !Number.isFinite(supplierCost) || supplierCost <= 0 || ids.has(id) || names.has(catalogueName)) {
      throw new Error("Invalid or duplicate supplier catalogue entry; existing packages were not changed.");
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
        sku: `G2B_${prefix}_${id}`,
        name: catalogueName === "Weekly" ? "Weekly Diamond Pass" : catalogueName === "Twilight" ? "Twilight Pass" : pack ? catalogueName : `${catalogueName} Diamonds`,
        description: `${prefix} (${catalogueName})`,
        amount: pass ? "1 Pass" : pack ? "1 Pack" : catalogueName,
        ...(prefix.startsWith("MLBB") ? { iconUrl: getMlbbIconUrl(catalogueName) } : {}),
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
