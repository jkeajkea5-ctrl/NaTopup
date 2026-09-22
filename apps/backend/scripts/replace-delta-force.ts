import dotenv from "dotenv";
import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { PrismaClient } from "@prisma/client";
import { prepareDeltaForceCatalogue } from "../lib/deltaForceCatalogue";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });
dotenv.config({ path: path.resolve(__dirname, "../.env") });

async function main() {
  if (!process.env.DATABASE_URL?.startsWith("mongodb")) throw new Error("A MongoDB DATABASE_URL is required.");
  const { g2bulkAdapter } = await import("../suppliers/g2bulk/client");
  const { config } = await import("../lib/config");
  const packages = prepareDeltaForceCatalogue(await g2bulkAdapter.getDeltaForceCatalogue());
  console.log(`Validated ${packages.length} Delta Force Cambodia packages.`);
  const db = new PrismaClient({ log: [] });
  try {
    const oldGames = await db.game.findMany({ where: { slug: "delta-force" } });
    const oldProducts = await db.product.findMany({ where: { gameId: { in: oldGames.map((g) => g.id) } }, include: { price: true, mappings: { include: { supplierProduct: true } } } });
    const backupDir = path.resolve(__dirname, "../backups"); await mkdir(backupDir, { recursive: true });
    const backupPath = path.join(backupDir, `delta-force-${new Date().toISOString().replace(/[:.]/g, "-")}.json`); await writeFile(backupPath, JSON.stringify({ games: oldGames, products: oldProducts }, null, 2), { flag: "wx" }); console.log(`Saved backup: ${backupPath}`);
    const result = await db.$transaction(async (tx) => {
      const game = await tx.game.upsert({ where: { slug: "delta-force" }, update: { region: "Cambodia", isActive: true, logoUrl: "/games/delta-force.jpg" }, create: { slug: "delta-force", name: "Delta Force", category: "Shooter", logoUrl: "/games/delta-force.jpg", bannerUrl: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=1200&auto=format&fit=crop&q=80", region: "Cambodia", instructions: "Enter your Delta Force Player ID. Packages are delivered to your game account.", deliveryTime: "Instant (1-3 mins)", isPopular: true, sortOrder: 7 } });
      const field = { fieldKey: "playerId", fieldLabel: "Player ID", placeholder: "Enter your Delta Force Player ID", fieldType: "text", isRequired: true, sortOrder: 1 };
      await tx.gameField.upsert({ where: { gameId_fieldKey: { gameId: game.id, fieldKey: field.fieldKey } }, update: field, create: { ...field, gameId: game.id } });
      const supplier = await tx.supplier.upsert({ where: { code: "G2BULK" }, update: {}, create: { code: "G2BULK", name: "G2Bulk", baseUrl: config.g2bulk.baseUrl } });
      let deleted = 0; let archived = 0;
      for (const product of oldProducts) { const orders = await tx.order.count({ where: { productId: product.id } }); if (orders) { await tx.product.update({ where: { id: product.id }, data: { isActive: false, sku: `ARCHIVED_DELTA_${product.id}` } }); archived++; } else { await tx.supplierMapping.deleteMany({ where: { productId: product.id } }); await tx.productPrice.deleteMany({ where: { productId: product.id } }); await tx.product.delete({ where: { id: product.id } }); deleted++; } }
      for (const entry of packages) { const supplierProduct = await tx.supplierProduct.upsert({ where: { supplierId_supplierProductCode: { supplierId: supplier.id, supplierProductCode: entry.supplierProductCode } }, update: { supplierGameCode: "deltaforce", supplierProductName: entry.catalogueName, currentCost: entry.price.supplierCost, isAvailable: true, lastSyncAt: new Date() }, create: { supplierId: supplier.id, supplierProductCode: entry.supplierProductCode, supplierGameCode: "deltaforce", supplierProductName: entry.catalogueName, currentCost: entry.price.supplierCost } }); await tx.product.create({ data: { ...entry.product, gameId: game.id, price: { create: entry.price }, mappings: { create: { supplierId: supplier.id, supplierProductId: supplierProduct.id, priority: 1, isEnabled: true } } } }); }
      return { deleted, archived, imported: packages.length };
    }, { maxWait: 10000, timeout: 120000 });
    console.log(JSON.stringify(result)); const saved = await db.product.count({ where: { game: { slug: "delta-force" }, isActive: true } }); if (saved !== packages.length) throw new Error("Imported package count verification failed."); console.log(`Verified ${saved} active Delta Force packages in MongoDB.`);
  } finally { await db.$disconnect(); }
}
main().catch((error) => { console.error(error?.code ? `Import failed (${error.code}). Check MongoDB connectivity.` : error.message); process.exitCode = 1; });
