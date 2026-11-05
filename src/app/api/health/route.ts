import { createHealthHandler } from "@/lib/ops/health";
import { prisma } from "@/lib/prisma";

// Her istekte gerçek veritabanı kontrolü: önbelleğe alınmaz (bkz. CLAUDE.md 1.5, 1.9).
export const dynamic = "force-dynamic";

export const GET = createHealthHandler({ pingDatabase: () => prisma.$queryRaw`SELECT 1` });
