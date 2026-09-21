import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const url = process.env.DATABASE_URL || "";

async function testConnection() {
  console.log("\n==========================================");
  console.log("🔍 Checking MongoDB Atlas Connection...");
  console.log("==========================================");

  if (url.includes("<db_password>")) {
    console.error("\n❌ Error: DATABASE_URL still contains placeholder '<db_password>'.");
    console.error("👉 Please replace <db_password> with your actual MongoDB database password in apps/backend/.env\n");
    process.exit(1);
  }

  const maskedUrl = url.replace(/:([^:@]+)@/, ":****@");
  console.log(`Target Connection: ${maskedUrl}`);

  const prisma = new PrismaClient();

  try {
    console.log("Connecting to MongoDB Atlas...");
    await prisma.$connect();
    console.log("✅ Successfully connected to MongoDB Atlas!");

    // Try a quick read
    const gamesCount = await prisma.game.count();
    console.log(`Current games in database: ${gamesCount}`);

    console.log("\n✨ MongoDB is ready for production use!");
  } catch (error: any) {
    console.error("\n❌ Connection failed:");
    console.error(error.message || error);
    console.log("\n💡 Tips to resolve:");
    console.log(" 1. Check your password in apps/backend/.env");
    console.log(" 2. In MongoDB Atlas -> Network Access, ensure IP Access list includes 0.0.0.0/0 (or your current IP)");
    console.log(" 3. In MongoDB Atlas -> Database Access, ensure user 'db_alucard' has readWrite permissions");
  } finally {
    await prisma.$disconnect();
  }
}

testConnection();
