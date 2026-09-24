import { prisma } from "../lib/prisma";
import { getMlbbIconUrl, MLBB_BEST_SELLING } from "../lib/mlbbCatalogue";
import { g2bulkAdapter } from "../suppliers/g2bulk/client";
import { vizoAdapter } from "../suppliers/vizo/client";

type LiveItem = {
  externalId: string;
  name: string;
  cost: number;
  available: boolean;
};

const normalize = (value: unknown) => String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const money = (value: number) => Math.round(value * 100) / 100;
const mlbbSlugs = new Set(["mobile-legends", "mobile-legends-philippines", "mobile-legends-indonesia"]);

function displayName(slug: string, supplierName: string) {
  if (!mlbbSlugs.has(slug)) return supplierName;
  if (supplierName === "Weekly") return "Weekly Diamond Pass";
  if (supplierName === "Twilight") return "Twilight Pass";
  if (/pack/i.test(supplierName)) return supplierName;
  return `${supplierName} Diamonds`;
}

function supplierCode(provider: string, gameCode: string, item: LiveItem) {
  return provider === "G2BULK"
    ? `G2B:${gameCode}:${item.externalId}:${item.name}`
    : item.externalId;
}

function storedExternalId(provider: string, code: string) {
  if (provider === "G2BULK" && code.startsWith("G2B:")) return code.split(":")[2] || "";
  return provider === "VIZO" ? code : "";
}

async function fetchLive(provider: string, gameCode: string): Promise<LiveItem[]> {
  const raw = provider === "G2BULK"
    ? await g2bulkAdapter.getGameCatalogue(gameCode)
    : await vizoAdapter.getGameCatalogue(gameCode);
  return raw.map((item: any) => ({
    externalId: String(provider === "G2BULK" ? item.id : item.product_code ?? item.id ?? "").trim(),
    name: String(item.name ?? item.product_name ?? "").trim(),
    cost: Number(provider === "G2BULK" ? item.amount : item.sell_price ?? item.amount),
    available: provider === "G2BULK" || !item.status || String(item.status).toLowerCase() === "active",
  })).filter((item: LiveItem) => item.externalId && item.name && Number.isFinite(item.cost) && item.cost > 0);
}

export class CatalogSyncService {
  async syncGame(gameId: string) {
    const game = await prisma.game.findUnique({
      where: { id: gameId },
      include: {
        products: {
          include: {
            price: true,
            mappings: { include: { supplier: true, supplierProduct: true } },
            _count: { select: { orders: true } },
          },
        },
      },
    });
    if (!game) throw new Error("Game not found.");

    const sourceMap = new Map<string, { supplierId: string; provider: string; gameCode: string }>();
    for (const product of game.products) {
      if (!product.isActive) continue;
      for (const mapping of product.mappings) {
        if (!mapping.isEnabled || !mapping.supplier.isEnabled) continue;
        const provider = mapping.supplier.code;
        if (provider !== "G2BULK" && provider !== "VIZO") continue;
        const gameCode = mapping.supplierProduct.supplierGameCode;
        sourceMap.set(`${provider}:${gameCode}`, { supplierId: mapping.supplierId, provider, gameCode });
      }
    }
    const sources = [...sourceMap.values()];
    if (!sources.length) throw new Error("This game has no G2Bulk or Vizo catalog mapping.");

    const liveSources = await Promise.all(sources.map(async (source) => {
      const items = await fetchLive(source.provider, source.gameCode);
      if (!items.length) throw new Error(`${source.provider} returned an empty ${source.gameCode} catalog. No packages were changed.`);
      return { ...source, items };
    }));

    return prisma.$transaction(async (tx) => {
      let added = 0;
      let updated = 0;
      let deleted = 0;
      let archived = 0;
      let unavailable = 0;
      const matchedMappings = new Set<string>();
      const touchedProducts = new Set<string>();
      const existingProducts = [...game.products].sort((a, b) => Number(b.isActive) - Number(a.isActive));
      let nextSortOrder = existingProducts.reduce((max, product) => Math.max(max, product.sortOrder), -1) + 1;

      for (const source of liveSources) {
        const sourceMappings = existingProducts.flatMap((product) => product.mappings
          .filter((mapping) => mapping.supplierId === source.supplierId && mapping.supplierProduct.supplierGameCode === source.gameCode)
          .map((mapping) => ({ product, mapping })));

        for (const item of source.items) {
          const match = sourceMappings.find(({ mapping }) =>
            storedExternalId(source.provider, mapping.supplierProduct.supplierProductCode) === item.externalId ||
            normalize(mapping.supplierProduct.supplierProductName) === normalize(item.name)
          );
          const formattedName = displayName(game.slug, item.name);
          let product = match?.product;

          const code = supplierCode(source.provider, source.gameCode, item);
          let supplierProduct = match?.mapping.supplierProduct;
          if (supplierProduct) {
            supplierProduct = await tx.supplierProduct.update({
              where: { id: supplierProduct.id },
              data: {
                supplierProductCode: code,
                supplierProductName: item.name,
                currentCost: item.cost,
                currency: "USD",
                isAvailable: item.available,
                lastSyncAt: new Date(),
              },
            });
          } else {
            supplierProduct = await tx.supplierProduct.upsert({
              where: { supplierId_supplierProductCode: { supplierId: source.supplierId, supplierProductCode: code } },
              update: { supplierGameCode: source.gameCode, supplierProductName: item.name, currentCost: item.cost, isAvailable: item.available, lastSyncAt: new Date() },
              create: { supplierId: source.supplierId, supplierGameCode: source.gameCode, supplierProductCode: code, supplierProductName: item.name, currentCost: item.cost, isAvailable: item.available },
            });
          }

          if (!product) {
            product = existingProducts.find((candidate) => normalize(candidate.name) === normalize(formattedName));
          }
          if (!product) {
            const markup = Math.max(0.05, money(item.cost * 0.1));
            product = await tx.product.create({
              data: {
                gameId: game.id,
                sku: `SYNC_${source.provider}_${source.gameCode}_${item.externalId}`.replace(/[^A-Za-z0-9_.-]/g, "_"),
                name: formattedName,
                description: `${game.name} (${item.name})`,
                amount: /^(Weekly|Twilight)$/i.test(item.name) ? "1 Pass" : /pack/i.test(item.name) ? "1 Pack" : item.name,
                iconUrl: mlbbSlugs.has(game.slug) ? getMlbbIconUrl(item.name) : null,
                isPopular: mlbbSlugs.has(game.slug) && MLBB_BEST_SELLING.includes(item.name),
                isFeatured: false,
                isActive: item.available,
                sortOrder: nextSortOrder++,
                price: { create: { supplierCost: item.cost, markupValue: markup, sellingPrice: money(item.cost + markup), discount: 0 } },
              },
              include: { price: true, mappings: { include: { supplier: true, supplierProduct: true } }, _count: { select: { orders: true } } },
            });
            existingProducts.push(product as any);
            added++;
          } else {
            await tx.product.update({ where: { id: product.id }, data: { name: formattedName, isActive: item.available } });
            updated++;
          }

          const mapping = await tx.supplierMapping.upsert({
            where: { productId_supplierId: { productId: product.id, supplierId: source.supplierId } },
            update: { supplierProductId: supplierProduct.id, isEnabled: item.available },
            create: { productId: product.id, supplierId: source.supplierId, supplierProductId: supplierProduct.id, priority: 1, isEnabled: item.available },
          });
          matchedMappings.add(mapping.id);
          if (match) matchedMappings.add(match.mapping.id);
          touchedProducts.add(product.id);
        }

        for (const { product, mapping } of sourceMappings) {
          if (matchedMappings.has(mapping.id)) continue;
          await tx.supplierMapping.update({ where: { id: mapping.id }, data: { isEnabled: false } });
          await tx.supplierProduct.update({ where: { id: mapping.supplierProductId }, data: { isAvailable: false, lastSyncAt: new Date() } });
          touchedProducts.add(product.id);
          unavailable++;
        }
      }

      for (const productId of touchedProducts) {
        const current = await tx.product.findUnique({
          where: { id: productId },
          include: { price: true, mappings: { where: { isEnabled: true }, orderBy: { priority: "asc" }, include: { supplierProduct: true } }, _count: { select: { orders: true } } },
        });
        if (!current) continue;
        const primary = current.mappings.find((mapping) => mapping.supplierProduct.isAvailable);
        if (!primary) {
          if (current._count.orders > 0) {
            await tx.product.update({ where: { id: current.id }, data: { isActive: false } });
            archived++;
          } else {
            await tx.supplierMapping.deleteMany({ where: { productId: current.id } });
            await tx.productPrice.deleteMany({ where: { productId: current.id } });
            await tx.product.delete({ where: { id: current.id } });
            deleted++;
          }
          continue;
        }
        if (current.price) {
          const margin = Math.max(current.price.markupValue, current.price.sellingPrice - current.price.supplierCost, 0.05);
          const nextPrice = money(primary.supplierProduct.currentCost + margin);
          await tx.productPrice.update({
            where: { productId: current.id },
            data: { supplierCost: primary.supplierProduct.currentCost, sellingPrice: nextPrice, discount: Math.min(current.price.discount, Math.max(0, nextPrice - primary.supplierProduct.currentCost)) },
          });
        }
      }

      const result = { game: game.name, sources: liveSources.map(({ provider, gameCode, items }) => ({ provider, gameCode, received: items.length })), added, updated, deleted, archived, unavailable };
      await tx.auditLog.create({
        data: {
          action: "SUPPLIER_CATALOG_SYNC",
          entity: "Game",
          entityId: game.id,
          newValue: JSON.stringify(result),
        },
      });
      return result;
    }, { maxWait: 10000, timeout: 120000 });
  }
}

export const catalogSyncService = new CatalogSyncService();
