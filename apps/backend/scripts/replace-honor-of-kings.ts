import dotenv from "dotenv";
import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { PrismaClient } from "@prisma/client";
import { prepareHokCatalogue } from "../lib/hokCatalogue";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });
dotenv.config({ path: path.resolve(__dirname, "../.env") });

async function main() {
  if (!process.env.DATABASE_URL?.startsWith("mongodb")) throw new Error("A MongoDB DATABASE_URL is required.");
  const { g2bulkAdapter } = await import("../suppliers/g2bulk/client");
  const { config } = await import("../lib/config");
  const packages = prepareHokCatalogue(await g2bulkAdapter.getHokCatalogue());
  console.log(`Validated ${packages.length} Honor of Kings packages.`);

  const db = new PrismaClient({ log: [] });
  try {
    const games = await db.game.findMany({ where: { slug: { in: ["honor-of-kings", "hok"] } } });
    const oldProducts = await db.product.findMany({
      where: { gameId: { in: games.map((game) => game.id) } },
      include: { price: true, mappings: { include: { supplierProduct: true } } },
    });
    const backupDir = path.resolve(__dirname, "../backups");
    await mkdir(backupDir, { recursive: true });
    const backupPath = path.join(backupDir, `honor-of-kings-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
    await writeFile(backupPath, JSON.stringify({ games, products: oldProducts }, null, 2), { flag: "wx" });
    console.log(`Saved backup: ${backupPath}`);

    const result = await db.$transaction(async (tx) => {
      const game = await tx.game.upsert({
        where: { slug: "honor-of-kings" },
        update: { name: "Honor of Kings", region: "Global", logoUrl: "/games/honor-of-kings.png", isActive: true, isPopular: true },
        create: {
          slug: "honor-of-kings", name: "Honor of Kings", category: "MOBA",
          logoUrl: "/games/honor-of-kings.png", bannerUrl: "/games/honor-of-kings.png", region: "Global",
          instructions: "Enter your Honor of Kings Player ID.", deliveryTime: "Instant (1-3 mins)", isPopular: true, sortOrder: 4,
        },
      });
      await tx.gameField.upsert({
        where: { gameId_fieldKey: { gameId: game.id, fieldKey: "playerId" } },
        update: { fieldLabel: "Player ID", placeholder: "Enter your Player ID", isRequired: true, sortOrder: 0 },
        create: { gameId: game.id, fieldKey: "playerId", fieldLabel: "Player ID", placeholder: "Enter your Player ID", fieldType: "text", isRequired: true, sortOrder: 0 },
      });
      const supplier = await tx.supplier.upsert({
        where: { code: "G2BULK" }, update: { baseUrl: config.g2bulk.baseUrl, isEnabled: true },
        create: { code: "G2BULK", name: "G2Bulk", baseUrl: config.g2bulk.baseUrl },
      });

      let deleted = 0;
      let archived = 0;
      for (const product of oldProducts) {
        const orderCount = await tx.order.count({ where: { productId: product.id } });
        if (orderCount > 0) {
          await tx.product.update({ where: { id: product.id }, data: { isActive: false, sku: `ARCHIVED_HOK_${product.id}` } });
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
          where: { supplierId_supplierProductCode: { supplierId: supplier.id, supplierProductCode: entry.supplierProductCode } },
          update: { supplierGameCode: "hok", supplierProductName: entry.catalogueName, currentCost: entry.price.supplierCost, isAvailable: true, lastSyncAt: new Date() },
          create: { supplierId: supplier.id, supplierProductCode: entry.supplierProductCode, supplierGameCode: "hok", supplierProductName: entry.catalogueName, currentCost: entry.price.supplierCost },
        });
        await tx.product.create({ data: {
          ...entry.product, gameId: game.id, price: { create: entry.price },
          mappings: { create: { supplierId: supplier.id, supplierProductId: supplierProduct.id, priority: 1, isEnabled: true } },
        } });
      }
      return { deleted, archived, imported: packages.length };
    }, { maxWait: 10000, timeout: 120000 });

    console.log(JSON.stringify(result));
    const saved = await db.product.count({ where: { game: { slug: "honor-of-kings" }, isActive: true } });
    if (saved !== packages.length) throw new Error("Imported Honor of Kings package count verification failed.");
    console.log(`Verified ${saved} active Honor of Kings packages in MongoDB.`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error?.code ? `Import failed (${error.code}). Check MongoDB connectivity. Transaction changes, if any, were rolled back.` : error.message);
  process.exitCode = 1;
});
