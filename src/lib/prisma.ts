import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { env } from "@/lib/env";

/**
 * Next.js dev modunda hot-reload her modülü yeniden çalıştırır; `globalThis` üzerinde
 * tek bir örnek tutulmazsa her reload'da yeni bir PostgreSQL bağlantı havuzu açılır ve
 * bağlantılar tükenir. Bu yüzden PrismaClient, üretimde tek seferlik, geliştirmede
 * global'e önbelleklenmiş tekil (singleton) olarak oluşturulur.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrismaClient(): PrismaClient {
  const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
