import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "@/generated/prisma/client";
import { hashPassword } from "@/lib/auth/password";
import { env } from "@/lib/env";

const adapter = new PrismaLibSql({ url: env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

/**
 * Tek admin hesabını oluşturur/günceller — `npx prisma db seed` ile çalıştırılır.
 * Idempotent: aynı ADMIN_EMAIL ile tekrar çalıştırıldığında şifreyi günceller.
 */
async function main() {
  if (!env.ADMIN_EMAIL || !env.ADMIN_PASSWORD) {
    throw new Error("ADMIN_EMAIL ve ADMIN_PASSWORD .env.local içinde tanımlı olmalı.");
  }

  const email = env.ADMIN_EMAIL.toLowerCase().trim();
  const passwordHash = await hashPassword(env.ADMIN_PASSWORD);

  const admin = await prisma.adminUser.upsert({
    where: { email },
    update: { passwordHash },
    create: { email, passwordHash },
  });

  console.log(`Admin hesabı hazır: ${admin.email}`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
