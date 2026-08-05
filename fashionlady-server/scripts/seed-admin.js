/**
 * Seed script to create an initial admin user
 * Run: node scripts/seed-admin.js
 */

const prisma = require("../lib/prismaClient");
const bcrypt = require("bcryptjs");
require("dotenv").config();

async function seedAdmin() {
  try {
    console.log("🌱 Seeding admin user...");

    // Check if admin already exists
    const existingAdmin = await prisma.admin.findUnique({
      where: { email: "admin@fasionfeel.com" },
    });

    if (existingAdmin) {
      console.log("✅ Admin user already exists");
      return;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash("admin123", 10);

    // Create admin user
    const admin = await prisma.admin.create({
      data: {
        email: "admin@fasionfeel.com",
        password: hashedPassword,
        name: "Admin",
      },
    });

    console.log("✅ Admin user created successfully!");
    console.log(`📧 Email: ${admin.email}`);
    console.log("🔑 Password: admin123 (Please change this after first login)");
  } catch (error) {
    console.error("❌ Error seeding admin:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

seedAdmin();
