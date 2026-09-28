import { prisma } from "@/lib/prisma";
import { postInclude, toPostView } from "@/lib/dashboard/post-view";
import type { CalendarSummary, SocialPostView } from "@/types/social";

export async function getPostsInRange(from: Date, to: Date): Promise<SocialPostView[]> {
  const rows = await prisma.socialPost.findMany({
    where: { scheduledFor: { gte: from, lte: to } },
    include: postInclude,
    orderBy: { scheduledFor: "asc" },
  });
  return rows.map(toPostView);
}

/** Liste görünümü ve tablolar için: planlanan tarihe göre en yeniden geriye doğru. */
export async function getRecentPosts(limit: number): Promise<SocialPostView[]> {
  const rows = await prisma.socialPost.findMany({
    include: postInclude,
    orderBy: { scheduledFor: "desc" },
    take: limit,
  });
  return rows.map(toPostView);
}

/** Şu andan sonra planlanmış gönderiler, en yakın tarihten başlayarak. */
export async function getUpcomingPosts(limit: number): Promise<SocialPostView[]> {
  const rows = await prisma.socialPost.findMany({
    where: { scheduledFor: { gte: new Date() } },
    include: postInclude,
    orderBy: { scheduledFor: "asc" },
    take: limit,
  });
  return rows.map(toPostView);
}

export async function getPostById(id: string): Promise<SocialPostView | null> {
  const row = await prisma.socialPost.findUnique({ where: { id }, include: postInclude });
  return row ? toPostView(row) : null;
}

export async function getCalendarSummary(): Promise<CalendarSummary> {
  const groups = await prisma.socialPost.groupBy({ by: ["status"], _count: { _all: true } });
  const countOf = (status: "PREPARING" | "PUBLISHED") =>
    groups.find((group) => group.status === status)?._count._all ?? 0;
  const preparingCount = countOf("PREPARING");
  const publishedCount = countOf("PUBLISHED");
  return { preparingCount, publishedCount, totalCount: preparingCount + publishedCount };
}
