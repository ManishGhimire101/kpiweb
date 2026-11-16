const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting database seed...");

  const username = process.env.SUPER_ADMIN_USERNAME;
  const password = process.env.SUPER_ADMIN_PASSWORD;

  if (!username || !password) {
    throw new Error(
      "SUPER_ADMIN_USERNAME and SUPER_ADMIN_PASSWORD must be set in .env"
    );
  }

  // Check whether a Super Admin already exists
  const existingSuperAdmin = await prisma.user.findFirst({
    where: {
      role: "SUPER_ADMIN",
    },
  });

  if (existingSuperAdmin) {
    console.log("ℹ️ Super Admin already exists.");
    console.log(`Username: ${existingSuperAdmin.username}`);
    return;
  }

  // Hash password
  const passwordHash = await bcrypt.hash(password, 12);

  // Create Super Admin
  const superAdmin = await prisma.user.create({
    data: {
      username,
      passwordHash,
      role: "SUPER_ADMIN",
      institutionId: null,
      isActive: true,
      mustChangePassword: true,
    },
  });

  console.log("✅ Super Admin created successfully!");
  console.log(`Username: ${superAdmin.username}`);
  console.log(`User ID: ${superAdmin.id}`);
}

main()
  .catch((error) => {
    console.error("❌ Seed failed:");
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });