import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { utcDay, xReadAllowance } from "@/lib/services/social/x-budget";

/** `XReadUsage` tablosunun tek erişim noktası — X okumalarının günlük sayacı. */

export interface XUsageToday {
  day: string;
  posts: number;
  users: number;
  requests: number;
  limit: number;
}

export async function getXUsageToday(now: Date = new Date()): Promise<XUsageToday> {
  const day = utcDay(now);
  const row = await prisma.xReadUsage.findUnique({ where: { day } });
  return { day, posts: row?.posts ?? 0, users: row?.users ?? 0, requests: row?.requests ?? 0, limit: env.X_DAILY_READ_LIMIT };
}

/** Bugün okunabilecek gönderi sayısı (en fazla `wanted`). */
export async function xPostAllowance(wanted: number, now: Date = new Date()): Promise<number> {
  const usage = await getXUsageToday(now);
  return xReadAllowance(usage.posts, usage.limit, wanted);
}

/** Bir X isteğinden sonra çağrılır: okunan (dönen) kaynak sayısı sayaca eklenir. */
export async function recordXRead(read: { posts?: number; users?: number }, now: Date = new Date()): Promise<void> {
  const posts = read.posts ?? 0;
  const users = read.users ?? 0;
  await prisma.xReadUsage.upsert({
    where: { day: utcDay(now) },
    update: { requests: { increment: 1 }, posts: { increment: posts }, users: { increment: users } },
    create: { day: utcDay(now), requests: 1, posts, users },
  });
}
