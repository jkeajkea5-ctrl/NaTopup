import dotenv from "dotenv";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { prepareMlbbGlobalCatalogue } from "../lib/mlbbCatalogue";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const SLUG = "mobile-legends-indonesia";
const SUPPLIER_GAME = "mlbb_global";

async function main() {
  if (!process.env.DATABASE_URL?.startsWith("mongodb")) {
    throw new Error("A MongoDB DATABASE_URL is required.");
  }

  const { g2bulkAdapter } = await import("../suppliers/g2bulk/client");
  const { config } = await import("../lib/config");
  const packages = prepareMlbbGlobalCatalogue(await g2bulkAdapter.getMlbbGlobalCatalogue());
  console.log(`Validated ${packages.length} Mobile Legends Indonesia packages.`);

  const db = new PrismaClient({ log: [] });
  try {
    const result = await db.$transaction(async (tx) => {
      const sourceGame = await tx.game.findUnique({
        where: { slug: "mobile-legends" },
        include: { fields: { orderBy: { sortOrder: "asc" } } },
      });
      if (!sourceGame) throw new Error("The existing Mobile Legends game is required as a field template.");

      const game = await tx.game.upsert({
        where: { slug: SLUG },
        update: {
          name: "Mobile Legends Indonesia",
          category: sourceGame.category,
          logoUrl: "https://api.g2bulk.com/images/mlbb_global.png",
          bannerUrl: sourceGame.bannerUrl,
          region: "Indonesia",
          instructions: sourceGame.instructions,
          deliveryTime: sourceGame.deliveryTime,
          isActive: true,
          isPopular: true,
        },
        create: {
          slug: SLUG,
          name: "Mobile Legends Indonesia",
          category: sourceGame.category,
          logoUrl: "https://api.g2bulk.com/images/mlbb_global.png",
          bannerUrl: sourceGame.bannerUrl,
          region: "Indonesia",
          instructions: sourceGame.instructions,
          deliveryTime: sourceGame.deliveryTime,
          isActive: true,
          isPopular: true,
          sortOrder: sourceGame.sortOrder + 2,
        },
      });

      for (const field of sourceGame.fields) {
        await tx.gameField.upsert({
          where: { gameId_fieldKey: { gameId: game.id, fieldKey: field.fieldKey } },
          update: {
            fieldLabel: field.fieldLabel,
            placeholder: field.placeholder,
            fieldType: field.fieldType,
            options: field.options,
            isRequired: field.isRequired,
            helperText: field.helperText,
            sortOrder: field.sortOrder,
          },
          create: {
            gameId: game.id,
            fieldKey: field.fieldKey,
            fieldLabel: field.fieldLabel,
            placeholder: field.placeholder,
            fieldType: field.fieldType,
            options: field.options,
            isRequired: field.isRequired,
            helperText: field.helperText,
            sortOrder: field.sortOrder,
          },
        });
      }

      const supplier = await tx.supplier.upsert({
        where: { code: "G2BULK" },
        update: { baseUrl: config.g2bulk.baseUrl, isEnabled: true },
        create: { code: "G2BULK", name: "G2Bulk", baseUrl: config.g2bulk.baseUrl },
      });

      const existingProducts = await tx.product.findMany({ where: { gameId: game.id } });
      let deleted = 0;
      let archived = 0;
      for (const product of existingProducts) {
        const orderCount = await tx.order.count({ where: { productId: product.id } });
        if (orderCount > 0) {
          await tx.product.update({
            where: { id: product.id },
            data: { isActive: false, sku: `ARCHIVED_MLBB_ID_${product.id}` },
          });
          archived++;
        } else {
          await tx.supplierMapping.deleteMany({ where: { productId: product.id } });
          await tx.productPrice.deleteMany({ where: { productId: product.id } });
          await tx.product.delete({ where: { id: product.id } });
          deleted++;
        }
      }

      for (const entry of packages) {
        const supplierProduct = await tx.supplierProduct.upsert({
          where: {
            supplierId_supplierProductCode: {
              supplierId: supplier.id,
              supplierProductCode: entry.supplierProductCode,
            },
          },
          update: {
            supplierGameCode: SUPPLIER_GAME,
            supplierProductName: entry.catalogueName,
            currentCost: entry.price.supplierCost,
            isAvailable: true,
            lastSyncAt: new Date(),
          },
          create: {
            supplierId: supplier.id,
            supplierProductCode: entry.supplierProductCode,
            supplierGameCode: SUPPLIER_GAME,
            supplierProductName: entry.catalogueName,
            currentCost: entry.price.supplierCost,
          },
        });
        await tx.product.create({
          data: {
            ...entry.product,
            description: `Mobile Legends Indonesia (${entry.catalogueName})`,
            gameId: game.id,
            price: { create: entry.price },
            mappings: {
              create: {
                supplierId: supplier.id,
                supplierProductId: supplierProduct.id,
                priority: 1,
                isEnabled: true,
              },
            },
          },
        });
      }

      return { gameId: game.id, deleted, archived, imported: packages.length };
    }, { maxWait: 10000, timeout: 120000 });

    const saved = await db.product.count({ where: { game: { slug: SLUG }, isActive: true } });
    if (saved !== packages.length) throw new Error("Imported package count verification failed.");
    console.log(JSON.stringify({ ...result, verified: saved }));
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error?.code ? `Import failed (${error.code}). Transaction changes were rolled back.` : error.message);
  process.exitCode = 1;
});
