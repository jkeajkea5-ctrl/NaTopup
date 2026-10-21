import test from "node:test";
import assert from "node:assert/strict";
import { toPublicGameSummary, toPublicProduct } from "../lib/publicCatalog";

test("public products omit internal SKUs, supplier pricing, and routing metadata", () => {
  const product = toPublicProduct({
    id: "product-1",
    sku: "PUBLIC-SKU",
    name: "100 Points",
    amount: "100",
    finalPriceUsd: 1.25,
    finalPriceKhr: 5200,
    supplierCost: 0.95,
    supplier: "PRIVATE_SUPPLIER",
    supplierGameCode: "private_game_code",
    catalogueName: "private catalogue name",
    apiKey: "never-public",
  });

  assert.equal(product.id, "product-1");
  assert.equal(product.finalPriceUsd, 1.25);
  assert.equal("sku" in product, false);
  assert.equal("supplierCost" in product, false);
  assert.equal("supplier" in product, false);
  assert.equal("supplierGameCode" in product, false);
  assert.equal("catalogueName" in product, false);
  assert.equal("apiKey" in product, false);
});

test("fallback game summaries cannot expose nested products", () => {
  const game = toPublicGameSummary({
    id: "game-1",
    slug: "example",
    name: "Example",
    products: [{ supplierCost: 10 }, { supplierCost: 20 }],
  });

  assert.equal(game._count.products, 2);
  assert.equal("products" in game, false);
});
