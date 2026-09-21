import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "@/generated/prisma/client";
import { env } from "@/lib/env";

/**
 * Next.js dev modunda hot-reload her modülü yeniden çalıştırır; `globalThis` üzerinde
 * tek bir örnek tutulmazsa her reload'da yeni bir SQLite bağlantısı açılır ve
 * bağlantılar tükenir. Bu yüzden PrismaClient, üretimde tek seferlik, geliştirmede
 * global'e önbelleklenmiş tekil (singleton) olarak oluşturulur.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrismaClient(): PrismaClient {
  const adapter = new PrismaLibSql({ url: env.DATABASE_URL });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
