import dotenv from "dotenv";
import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { PrismaClient } from "@prisma/client";
import { prepareFreeFireCatalogue } from "../lib/freeFireCatalogue";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });
dotenv.config({ path: path.resolve(__dirname, "../.env") });

async function main() {
  if (!process.env.DATABASE_URL?.startsWith("mongodb")) throw new Error("A MongoDB DATABASE_URL is required.");
  const { vizoAdapter } = await import("../suppliers/vizo/client");
  const { config } = await import("../lib/config");
  const { FALLBACK_GAMES } = await import("../lib/fallbackData");
  const packages = prepareFreeFireCatalogue(await vizoAdapter.getGameCatalogue("freefire_sgmy"));
  console.log(`Validated ${packages.length} Vizo FreeFire MY packages.`);

  const db = new PrismaClient({ log: [] });
  try {
    const games = await db.game.findMany({ where: { slug: { in: ["free-fire", "free-fire-khsgmy"] } } });
    const oldProducts = await db.product.findMany({
      where: { gameId: { in: games.map((game) => game.id) } },
      include: { price: true, mappings: { include: { supplierProduct: true } } },
    });
    const backupDir = path.resolve(__dirname, "../backups");
    await mkdir(backupDir, { recursive: true });
    const backupPath = path.join(backupDir, `freefire-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
    await writeFile(backupPath, JSON.stringify({ games, products: oldProducts }, null, 2), { flag: "wx" });
    console.log(`Saved backup: ${backupPath}`);

    const result = await db.$transaction(async (tx) => {
      const defaults = FALLBACK_GAMES.find((game) => game.slug === "free-fire")!;
      const game = await tx.game.upsert({
        where: { slug: "free-fire" },
        update: { name: "FreeFire MY", region: "Malaysia", isActive: true },
        create: {
          slug: "free-fire", name: "FreeFire MY", category: defaults.category,
          logoUrl: defaults.logoUrl, bannerUrl: defaults.bannerUrl, region: "Malaysia",
          instructions: defaults.instructions, deliveryTime: defaults.deliveryTime, isPopular: true,
        },
      });
      for (const [sortOrder, field] of defaults.fields.entries()) {
        const { id, ...data } = field;
        await tx.gameField.upsert({
          where: { gameId_fieldKey: { gameId: game.id, fieldKey: field.fieldKey } },
          update: {}, create: { ...data, gameId: game.id, sortOrder },
        });
      }
      const supplier = await tx.supplier.upsert({
        where: { code: "VIZO" }, update: { baseUrl: config.vizo.baseUrl, isEnabled: true },
        create: { code: "VIZO", name: "Vizo Game Top-Up API", baseUrl: config.vizo.baseUrl },
      });

      let deleted = 0;
      let archived = 0;
      for (const product of oldProducts) {
        const orderCount = await tx.order.count({ where: { productId: product.id } });
        if (orderCount > 0) {
          await tx.product.update({ where: { id: product.id }, data: { isActive: false, sku: `ARCHIVED_FF_${product.id}` } });
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
          update: { supplierGameCode: "freefire_sgmy", supplierProductName: entry.supplierProductName, currentCost: entry.price.supplierCost, isAvailable: true, lastSyncAt: new Date() },
          create: { supplierId: supplier.id, supplierProductCode: entry.supplierProductCode, supplierGameCode: "freefire_sgmy", supplierProductName: entry.supplierProductName, currentCost: entry.price.supplierCost },
        });
        await tx.product.create({ data: {
          ...entry.product, gameId: game.id,
          price: { create: entry.price },
          mappings: { create: { supplierId: supplier.id, supplierProductId: supplierProduct.id, priority: 1, isEnabled: true } },
        } });
      }
      return { deleted, archived, imported: packages.length };
    }, { maxWait: 10000, timeout: 120000 });

    console.log(JSON.stringify(result));
    const saved = await db.product.count({ where: { game: { slug: "free-fire" }, isActive: true } });
    if (saved !== packages.length) throw new Error("Imported FreeFire MY package count verification failed.");
    console.log(`Verified ${saved} active FreeFire MY packages in MongoDB.`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error?.code ? `Import failed (${error.code}). Check MongoDB connectivity. Transaction changes, if any, were rolled back.` : error.message);
  process.exitCode = 1;
});
