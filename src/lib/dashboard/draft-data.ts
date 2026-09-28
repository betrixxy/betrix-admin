import { format } from "date-fns";
import { parseRenderOptions, parseStatsSnapshot } from "@/lib/dashboard/draft-snapshot";
import { PLATFORM_LABELS } from "@/lib/dashboard/social-meta";
import { prisma } from "@/lib/prisma";
import { STUDIO_FORMATS, type StudioFormat, type StudioPostOption } from "@/types/ai-content";
import type { DraftLookup, DraftSummary, DraftView } from "@/types/draft";

function toStudioFormat(value: string | null): StudioFormat | null {
  return STUDIO_FORMATS.find((format) => format === value) ?? null;
}

/**
 * İnceleme ekranı için taslak. Snapshot'ı olmayan (onay akışı öncesi) kayıtlar "legacy" döner —
 * maç verisi olmadan üretildikleri için yalnızca görüntülenir, düzenlenemez.
 */
export async function getDraft(id: string): Promise<DraftLookup | null> {
  const record = await prisma.aiContent.findUnique({ where: { id } });
  if (!record) return null;

  const stats = parseStatsSnapshot(record.statsSnapshot);
  const format = toStudioFormat(record.format);
  if (!stats || !format) {
    return { kind: "legacy", id: record.id, status: record.status, resultImageUrl: record.resultImageUrl };
  }

  const draft: DraftView = {
    id: record.id,
    status: record.status,
    format,
    caption: record.caption ?? "",
    prompt: record.prompt,
    resultImageUrl: record.resultImageUrl,
    postId: record.postId,
    stats,
    renderOptions: parseRenderOptions(record.renderOptions),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    reviewedAt: record.reviewedAt?.toISOString() ?? null,
  };
  return { kind: "draft", draft };
}

/** Onaylanan taslağın bağlanabileceği, aynı maça ait henüz paylaşılmamış gönderiler. */
export async function getLinkablePosts(fixtureId: string): Promise<StudioPostOption[]> {
  const posts = await prisma.socialPost.findMany({
    where: { fixtureId, status: "PREPARING" },
    include: { platform: true },
    orderBy: { scheduledFor: "asc" },
    take: 20,
  });
  return posts.map((post) => ({
    id: post.id,
    label: `${PLATFORM_LABELS[post.platform.type]} · ${format(post.scheduledFor, "d MMM HH:mm")}`,
  }));
}

/** Onay bekleyen taslaklar — en yeni önce. */
export async function getDraftQueue(limit = 20): Promise<DraftSummary[]> {
  const rows = await prisma.aiContent.findMany({
    where: { status: "DRAFT" },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { id: true, fixtureId: true, status: true, format: true, resultImageUrl: true, createdAt: true },
  });
  return rows.map((row) => ({ ...row, format: toStudioFormat(row.format), createdAt: row.createdAt.toISOString() }));
}

export interface FixtureDraftCounts {
  drafts: number;
  approved: number;
}

/** Maç Merkezi'nde her maçın yanında "2 taslak · 1 onaylı" rozeti için. */
export async function getDraftCountsByFixture(fixtureIds: string[]): Promise<Record<string, FixtureDraftCounts>> {
  if (fixtureIds.length === 0) return {};
  const groups = await prisma.aiContent.groupBy({
    by: ["fixtureId", "status"],
    where: { fixtureId: { in: fixtureIds }, status: { in: ["DRAFT", "APPROVED"] } },
    _count: { _all: true },
  });

  const counts: Record<string, FixtureDraftCounts> = {};
  for (const group of groups) {
    const entry = (counts[group.fixtureId] ??= { drafts: 0, approved: 0 });
    if (group.status === "DRAFT") entry.drafts = group._count._all;
    else entry.approved = group._count._all;
  }
  return counts;
}
