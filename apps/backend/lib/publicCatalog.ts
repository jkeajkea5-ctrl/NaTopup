const PUBLIC_PRODUCT_KEYS = [
  "id",
  "name",
  "description",
  "amount",
  "iconUrl",
  "customBadge",
  "isPopular",
  "isFeatured",
  "priceUsd",
  "discountUsd",
  "finalPriceUsd",
  "finalPriceKhr",
] as const;

export function toPublicProduct(product: Record<string, any>) {
  return Object.fromEntries(
    PUBLIC_PRODUCT_KEYS
      .filter((key) => product[key] !== undefined)
      .map((key) => [key, product[key]])
  );
}

export function toPublicProducts(products: Record<string, any>[] = []) {
  return products.map(toPublicProduct);
}

export function toPublicGameSummary(game: Record<string, any>) {
  return {
    id: game.id,
    slug: game.slug,
    name: game.name,
    category: game.category,
    logoUrl: game.logoUrl,
    bannerUrl: game.bannerUrl,
    region: game.region,
    deliveryTime: game.deliveryTime,
    isPopular: Boolean(game.isPopular),
    _count: {
      products: Number(game._count?.products ?? game.products?.length ?? 0),
    },
  };
}
