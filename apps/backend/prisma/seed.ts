import { PrismaClient } from "@prisma/client";
import { PricingStrategy, SupplierCode } from "@topup/shared";
import { hashAdminPassword } from "../lib/adminAuth";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting Database Seeding for Cambodian Game Top-Up Platform...");

  // 1. Create Admin User
  const initialPassword = process.env.ADMIN_INITIAL_PASSWORD || "password";
  const admin = await prisma.adminUser.upsert({
    where: { username: "admin" },
    update: process.env.ADMIN_INITIAL_PASSWORD ? { passwordHash: hashAdminPassword(initialPassword) } : {},
    create: {
      username: "admin",
      email: "admin@lukas-topup.kh",
      passwordHash: hashAdminPassword(initialPassword),
      role: "SUPERADMIN",
      isActive: true,
    },
  });
  console.log(`✓ Admin user configured: ${admin.username}`);

  const allowedIps = (process.env.ADMIN_ALLOWED_IPS || "").split(",").map((ip) => ip.trim()).filter(Boolean);
  for (const ipAddress of allowedIps) {
    await prisma.adminIpAllowlist.upsert({
      where: { ipAddress },
      update: { isActive: true },
      create: { ipAddress, label: "Configured during seed", isActive: true },
    });
  }

  // 2. Configure Suppliers
  const g2bulk = await prisma.supplier.upsert({
    where: { code: SupplierCode.G2BULK },
    update: {
      isEnabled: true,
      balance: 245.50,
      priority: 2,
    },
    create: {
      code: SupplierCode.G2BULK,
      name: "G2Bulk Direct Top-Up API",
      baseUrl: "https://api.g2bulk.com/v1",
      isEnabled: true,
      priority: 2,
      balance: 245.50,
      currency: "USD",
      healthStatus: "HEALTHY",
    },
  });

  const vizo = await prisma.supplier.upsert({
    where: { code: SupplierCode.VIZO },
    update: {
      isEnabled: true,
      balance: 512.80,
      priority: 1, // Preferred Primary
    },
    create: {
      code: SupplierCode.VIZO,
      name: "Vizo Game Top-Up API (vizoapp.store)",
      baseUrl: "https://api.vizoapp.store",
      isEnabled: true,
      priority: 1,
      balance: 512.80,
      currency: "USD",
      healthStatus: "HEALTHY",
    },
  });
  console.log("✓ Suppliers configured (G2Bulk & Vizo)");

  // 3. Seed Games & Custom Player Fields
  const gamesData = [
    {
      slug: "mobile-legends",
      name: "Mobile Legends: Bang Bang",
      category: "MOBA",
      logoUrl: "/games/mobile-legends.jpg",
      bannerUrl: "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=1200&auto=format&fit=crop&q=80",
      region: "All Regions",
      instructions: "Enter your User ID and Zone ID. Example: User ID 123456789, Zone ID 1234. Your Player Name will be verified instantly.",
      deliveryTime: "Instant (30 seconds)",
      isPopular: true,
      sortOrder: 1,
      fields: [
        { fieldKey: "userId", fieldLabel: "User ID", placeholder: "e.g. 123456789", fieldType: "text", isRequired: true, sortOrder: 1 },
        { fieldKey: "zoneId", fieldLabel: "Zone ID (Server)", placeholder: "e.g. 1234", fieldType: "text", isRequired: true, sortOrder: 2 },
      ],
      products: [
        { sku: "MLBB_86", name: "86 Diamonds", amount: "86", cost: 1.25, markup: 0.25, popular: true },
        { sku: "MLBB_172", name: "172 Diamonds", amount: "172", cost: 2.50, markup: 0.40, popular: false },
        { sku: "MLBB_257", name: "257 Diamonds", amount: "257", cost: 3.75, markup: 0.55, popular: true },
        { sku: "MLBB_706", name: "706 Diamonds", amount: "706", cost: 10.00, markup: 1.20, popular: false },
        { sku: "MLBB_WP", name: "Weekly Diamond Pass", amount: "1 Pass", cost: 1.70, markup: 0.29, popular: true },
        { sku: "MLBB_TP", name: "Twilight Pass", amount: "1 Pass", cost: 9.50, markup: 1.00, popular: false },
      ],
    },
    {
      slug: "free-fire",
      name: "FreeFire MY",
      category: "Battle Royale",
      logoUrl: "/games/free-fire.png",
      bannerUrl: "https://images.unsplash.com/photo-1563089145-599997674d42?w=1200&auto=format&fit=crop&q=80",
      region: "Malaysia",
      instructions: "Enter your Free Fire Player ID. You can find it on your in-game profile.",
      deliveryTime: "Instant (1-2 mins)",
      isPopular: true,
      sortOrder: 2,
      fields: [
        { fieldKey: "playerId", fieldLabel: "Player ID", placeholder: "e.g. 987654321", fieldType: "text", isRequired: true, sortOrder: 1 },
      ],
      products: [],
    },
    {
      slug: "pubg-mobile",
      name: "PUBG Mobile",
      category: "Battle Royale",
      logoUrl: "/games/pubg-mobile.png",
      bannerUrl: "https://images.unsplash.com/photo-1511512578047-dfb367046420?w=1200&auto=format&fit=crop&q=80",
      region: "Global",
      instructions: "Enter your PUBG Mobile Character ID. Delivery is processed directly to your in-game mailbox.",
      deliveryTime: "Instant (1-3 mins)",
      isPopular: true,
      sortOrder: 3,
      fields: [
        { fieldKey: "characterId", fieldLabel: "Character ID", placeholder: "e.g. 5123456789", fieldType: "text", isRequired: true, sortOrder: 1 },
      ],
      products: [],
    },
    {
      slug: "valorant",
      name: "Valorant",
      category: "Tactical Shooter",
      logoUrl: "/games/valorant.jpg",
      bannerUrl: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=1200&auto=format&fit=crop&q=80",
      region: "Riot Southeast Asia",
      instructions: "Enter your Riot ID and Tagline (e.g. TenZ#NA1).",
      deliveryTime: "Instant (1-2 mins)",
      isPopular: false,
      sortOrder: 4,
      fields: [
        { fieldKey: "riotId", fieldLabel: "Riot ID", placeholder: "e.g. Jett", fieldType: "text", isRequired: true, sortOrder: 1 },
        { fieldKey: "tagline", fieldLabel: "Tagline", placeholder: "e.g. SEA1", fieldType: "text", isRequired: true, sortOrder: 2 },
      ],
      products: [],
    },
    {
      slug: "honor-of-kings",
      name: "Honor of Kings",
      category: "MOBA",
      logoUrl: "/games/honor-of-kings.png",
      bannerUrl: "/games/honor-of-kings.png",
      region: "Global",
      instructions: "Enter your Honor of Kings Player ID.",
      deliveryTime: "Instant (1-3 mins)",
      isPopular: true,
      sortOrder: 4,
      fields: [
        { fieldKey: "playerId", fieldLabel: "Player ID", placeholder: "Enter your Player ID", fieldType: "text", isRequired: true, sortOrder: 1 },
      ],
      products: [],
    },
    {
      slug: "genshin-impact",
      name: "Genshin Impact",
      category: "RPG",
      logoUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=200&auto=format&fit=crop&q=80",
      bannerUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1200&auto=format&fit=crop&q=80",
      region: "Asia Server",
      instructions: "Enter your Genshin UID and select your game server.",
      deliveryTime: "Instant (1-3 mins)",
      isPopular: true,
      sortOrder: 5,
      fields: [
        { fieldKey: "uid", fieldLabel: "User ID (UID)", placeholder: "e.g. 800123456", fieldType: "text", isRequired: true, sortOrder: 1 },
        { 
          fieldKey: "server", 
          fieldLabel: "Server", 
          placeholder: "Select Server", 
          fieldType: "select", 
          isRequired: true, 
          options: JSON.stringify(["Asia", "America", "Europe", "TW/HK/MO"]),
          sortOrder: 2 
        },
      ],
      products: [
        { sku: "GEN_WELKIN", name: "Blessing of the Welkin Moon", amount: "30 Days", cost: 4.40, markup: 0.59, popular: true },
        { sku: "GEN_300", name: "300 + 30 Genesis Crystals", amount: "330", cost: 4.40, markup: 0.59, popular: false },
        { sku: "GEN_980", name: "980 + 110 Genesis Crystals", amount: "1090", cost: 13.50, markup: 1.50, popular: true },
      ],
    },
  ];

  for (const g of gamesData) {
    const game = await prisma.game.upsert({
      where: { slug: g.slug },
      update: {
        name: g.name,
        category: g.category,
        logoUrl: g.logoUrl,
        bannerUrl: g.bannerUrl,
        region: g.region,
        instructions: g.instructions,
        deliveryTime: g.deliveryTime,
        isPopular: g.isPopular,
        sortOrder: g.sortOrder,
      },
      create: {
        slug: g.slug,
        name: g.name,
        category: g.category,
        logoUrl: g.logoUrl,
        bannerUrl: g.bannerUrl,
        region: g.region,
        instructions: g.instructions,
        deliveryTime: g.deliveryTime,
        isPopular: g.isPopular,
        sortOrder: g.sortOrder,
      },
    });

    // Create Fields
    for (const f of g.fields) {
      await prisma.gameField.upsert({
        where: {
          gameId_fieldKey: {
            gameId: game.id,
            fieldKey: f.fieldKey,
          },
        },
        update: {
          fieldLabel: f.fieldLabel,
          placeholder: f.placeholder,
          fieldType: f.fieldType,
          isRequired: f.isRequired,
          options: (f as any).options || null,
          sortOrder: f.sortOrder,
        },
        create: {
          gameId: game.id,
          fieldKey: f.fieldKey,
          fieldLabel: f.fieldLabel,
          placeholder: f.placeholder,
          fieldType: f.fieldType,
          isRequired: f.isRequired,
          options: (f as any).options || null,
          sortOrder: f.sortOrder,
        },
      });
    }

    // Create Products & Prices & Mappings
    for (const p of g.products) {
      const product = await prisma.product.upsert({
        where: { sku: p.sku },
        update: {
          name: p.name,
          amount: p.amount,
          isPopular: p.popular,
          gameId: game.id,
        },
        create: {
          gameId: game.id,
          sku: p.sku,
          name: p.name,
          amount: p.amount,
          isPopular: p.popular,
        },
      });

      const sellingPrice = Math.round((p.cost + p.markup) * 100) / 100;
      await prisma.productPrice.upsert({
        where: { productId: product.id },
        update: {
          supplierCost: p.cost,
          pricingStrategy: PricingStrategy.FIXED_MARKUP,
          markupValue: p.markup,
          sellingPrice: sellingPrice,
          currency: "USD",
        },
        create: {
          productId: product.id,
          supplierCost: p.cost,
          pricingStrategy: PricingStrategy.FIXED_MARKUP,
          markupValue: p.markup,
          sellingPrice: sellingPrice,
          currency: "USD",
        },
      });

      // Seed Supplier Product & Mappings for Vizo (primary) and G2Bulk (secondary)
      const vizoSupplierProd = await prisma.supplierProduct.upsert({
        where: {
          supplierId_supplierProductCode: {
            supplierId: vizo.id,
            supplierProductCode: `VIZO_${p.sku}`,
          },
        },
        update: {
          currentCost: p.cost,
        },
        create: {
          supplierId: vizo.id,
          supplierGameCode: g.slug,
          supplierProductCode: `VIZO_${p.sku}`,
          supplierProductName: p.name,
          currentCost: p.cost,
          currency: "USD",
        },
      });

      await prisma.supplierMapping.upsert({
        where: {
          productId_supplierId: {
            productId: product.id,
            supplierId: vizo.id,
          },
        },
        update: {
          supplierProductId: vizoSupplierProd.id,
          priority: 1,
          isEnabled: true,
        },
        create: {
          productId: product.id,
          supplierId: vizo.id,
          supplierProductId: vizoSupplierProd.id,
          priority: 1,
          isEnabled: true,
        },
      });

      const g2bulkSupplierProd = await prisma.supplierProduct.upsert({
        where: {
          supplierId_supplierProductCode: {
            supplierId: g2bulk.id,
            supplierProductCode: `G2B_${p.sku}`,
          },
        },
        update: {
          currentCost: p.cost * 1.02,
        },
        create: {
          supplierId: g2bulk.id,
          supplierGameCode: g.slug,
          supplierProductCode: `G2B_${p.sku}`,
          supplierProductName: p.name,
          currentCost: p.cost * 1.02,
          currency: "USD",
        },
      });

      await prisma.supplierMapping.upsert({
        where: {
          productId_supplierId: {
            productId: product.id,
            supplierId: g2bulk.id,
          },
        },
        update: {
          supplierProductId: g2bulkSupplierProd.id,
          priority: 2,
          isEnabled: true,
        },
        create: {
          productId: product.id,
          supplierId: g2bulk.id,
          supplierProductId: g2bulkSupplierProd.id,
          priority: 2,
          isEnabled: true,
        },
      });
    }

    console.log(`✓ Seeded game ${g.name} (${g.products.length} packages)`);
  }

  // 4. Seed Promotions for Banner Slider
  const promos = [
    {
      title: "Mobile Legends: 50% Bonus Diamonds",
      badge: "HOT DEAL",
      description: "Get instant bonus diamonds with KHQR payment. Verified player IDs with 0% risk of account loss.",
      bannerUrl: "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=1200&auto=format&fit=crop&q=80",
      targetUrl: "/game/mobile-legends",
      discountPct: 10.0,
      sortOrder: 1,
    },
    {
      title: "PUBG Mobile Royale Pass Release",
      badge: "SEASON PASS",
      description: "Instant UC top-up with official KHQR banking integration. 24/7 automated delivery in 30 seconds.",
      bannerUrl: "https://images.unsplash.com/photo-1511512578047-dfb367046420?w=1200&auto=format&fit=crop&q=80",
      targetUrl: "/game/pubg-mobile",
      discountPct: 5.0,
      sortOrder: 2,
    },
    {
      title: "Free Fire Mega Diamond Carnival",
      badge: "LIMITED TIME",
      description: "Exclusive top-up cashback via Bakong KHQR. Fast player account verification directly on checkout.",
      bannerUrl: "https://images.unsplash.com/photo-1563089145-599997674d42?w=1200&auto=format&fit=crop&q=80",
      targetUrl: "/game/free-fire",
      discountPct: 8.0,
      sortOrder: 3,
    },
  ];

  await prisma.promotion.deleteMany({});
  for (const promo of promos) {
    await prisma.promotion.create({
      data: promo,
    });
  }
  console.log("✓ Seeded promotional banners");

  // 5. Seed App Settings
  await prisma.appSetting.upsert({
    where: { key: "USD_TO_KHR_RATE" },
    update: { value: "4100" },
    create: { key: "USD_TO_KHR_RATE", value: "4100", type: "number" },
  });

  await prisma.appSetting.upsert({
    where: { key: "TELEGRAM_SUPPORT_HANDLE" },
    update: { value: "@LukasTopupSupport" },
    create: { key: "TELEGRAM_SUPPORT_HANDLE", value: "@LukasTopupSupport", type: "string" },
  });

  console.log("🎉 Database seeding completed successfully!");
}

main()
  .catch((e) => {
    console.error("Error during seeding:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
