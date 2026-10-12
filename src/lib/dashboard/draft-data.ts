import { format } from "date-fns";
import { z } from "zod";
import { WITHOUT_SCHEDULE_PLACEHOLDERS } from "@/lib/calendar/content-schedule";
import { parseRenderOptions, parseStatsSnapshot } from "@/lib/dashboard/draft-snapshot";
import { PLATFORM_LABELS } from "@/lib/dashboard/social-meta";
import { prisma } from "@/lib/prisma";
import { STUDIO_FORMATS, type StudioFormat, type StudioPostOption } from "@/types/ai-content";
import { parsePublishSettings, publishMediaOf } from "@/lib/dashboard/publish-caption";
import type { DraftLookup, DraftSummary, DraftView, PublishableDraft } from "@/types/draft";
import { DEFAULT_LINEUP_TEMPLATE_STYLE, LINEUP_TEMPLATE_STYLES } from "@/types/lineup";
import { DEFAULT_SOCIAL_FORMAT, SOCIAL_FORMAT_IDS } from "@/types/studio-formats";

/** Format seçiminden önceki kayıtlarda alan yok — o kartlar 4:5 (post) çizilmişti. */
const formatField = z.enum(SOCIAL_FORMAT_IDS).catch(DEFAULT_SOCIAL_FORMAT);

/** `AiContent.renderOptions` — market analizi kaydı (yalnızca inceleme ekranının okuduğu alanlar). */
const marketAnalysisOptionsSchema = z.object({
  kind: z.literal("MARKET_ANALYSIS"),
  format: formatField,
  homeImageUrl: z.string(),
  awayImageUrl: z.string(),
  home: z.object({ teamName: z.string() }),
  away: z.object({ teamName: z.string() }),
  marketPick: z.string(),
  marketRationale: z.string(),
});

/** `AiContent.renderOptions` — Muhtemel 11 kaydı (yalnızca inceleme ekranının okuduğu alanlar). */
const lineupOptionsSchema = z.object({
  kind: z.literal("PROBABLE_LINEUPS"),
  format: formatField,
  /** Şablon seçiminden önceki kayıtlarda yok — o kartlar taktik tahtasıyla çizilmişti. */
  templateStyle: z.enum(LINEUP_TEMPLATE_STYLES).catch(DEFAULT_LINEUP_TEMPLATE_STYLE),
  /** Kartların gerçekte çizildiği şablon (takım başına bağımsız) — yoksa iki kart da `templateStyle`. */
  cardStyles: z.object({ home: z.enum(LINEUP_TEMPLATE_STYLES), away: z.enum(LINEUP_TEMPLATE_STYLES) }).optional().catch(undefined),
  homeImageUrl: z.string(),
  awayImageUrl: z.string(),
  headline: z.string(),
  home: z.object({ teamName: z.string(), formation: z.string() }),
  away: z.object({ teamName: z.string(), formation: z.string() }),
});

/** `AiContent.renderOptions` — Haftanın Maçları kaydı (yalnızca inceleme ekranının okuduğu alanlar). */
const weeklyOptionsSchema = z.object({
  kind: z.literal("WEEKLY_FIXTURES"),
  format: formatField,
  imageUrl: z.string(),
  leagueName: z.string(),
  title: z.string(),
  matchIds: z.array(z.string()),
});

/** `AiContent.renderOptions` — Puan Durumu kaydı (yalnızca inceleme ekranının okuduğu alanlar). */
const standingsOptionsSchema = z.object({
  kind: z.literal("STANDINGS"),
  format: formatField,
  imageUrl: z.string(),
  leagueName: z.string(),
  title: z.string(),
  kindLabel: z.string(),
  sections: z.array(z.object({ rows: z.array(z.unknown()) })),
});

/** Yayın Merkezi alanları — görseller ve kayıtlı yayın ayarları doğrudan kayıttan okunur. */
function publishable(record: { renderOptions: unknown; resultImageUrl: string | null }): PublishableDraft {
  return { media: publishMediaOf(record.renderOptions, record.resultImageUrl), publish: parsePublishSettings(record.renderOptions) };
}

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

  if (record.contentType === "AI_MARKET_PREDICTION") {
    const options = marketAnalysisOptionsSchema.safeParse(record.renderOptions);
    if (options.success) {
      const { home, away, homeImageUrl, awayImageUrl, marketPick, marketRationale, format } = options.data;
      return {
        kind: "market-analysis",
        draft: {
          id: record.id,
          fixtureId: record.fixtureId,
          status: record.status,
          caption: record.caption ?? "",
          postId: record.postId,
          reviewedAt: record.reviewedAt?.toISOString() ?? null,
    ...publishable(record),
          format,
          home: { teamName: home.teamName, imageUrl: homeImageUrl },
          away: { teamName: away.teamName, imageUrl: awayImageUrl },
          marketPick,
          marketRationale,
        },
      };
    }
  }

  if (record.contentType === "WEEKLY_FIXTURES") {
    const options = weeklyOptionsSchema.safeParse(record.renderOptions);
    if (options.success) {
      const { imageUrl, leagueName, title, matchIds, format } = options.data;
      return {
        kind: "weekly-fixtures",
        draft: {
          id: record.id,
          fixtureId: record.fixtureId,
          status: record.status,
          caption: record.caption ?? "",
          postId: record.postId,
          reviewedAt: record.reviewedAt?.toISOString() ?? null,
    ...publishable(record),
          leagueName,
          title,
          imageUrl,
          matchCount: matchIds.length,
          format,
        },
      };
    }
  }

  if (record.contentType === "STANDINGS") {
    const options = standingsOptionsSchema.safeParse(record.renderOptions);
    if (options.success) {
      const { imageUrl, leagueName, title, kindLabel, sections, format } = options.data;
      return {
        kind: "standings",
        draft: {
          id: record.id,
          fixtureId: record.fixtureId,
          status: record.status,
          caption: record.caption ?? "",
          postId: record.postId,
          reviewedAt: record.reviewedAt?.toISOString() ?? null,
    ...publishable(record),
          leagueName,
          title,
          kindLabel,
          imageUrl,
          teamCount: sections.reduce((sum, section) => sum + section.rows.length, 0),
          format,
        },
      };
    }
  }

  if (record.contentType === "PROBABLE_LINEUPS") {
    const options = lineupOptionsSchema.safeParse(record.renderOptions);
    if (options.success) {
      const { home, away, homeImageUrl, awayImageUrl, headline, templateStyle, cardStyles, format } = options.data;
      return {
        kind: "lineup",
        draft: {
          id: record.id,
          fixtureId: record.fixtureId,
          status: record.status,
          caption: record.caption ?? "",
          postId: record.postId,
          reviewedAt: record.reviewedAt?.toISOString() ?? null,
    ...publishable(record),
          headline,
          format,
          home: { ...home, imageUrl: homeImageUrl, templateStyle: cardStyles?.home ?? templateStyle },
          away: { ...away, imageUrl: awayImageUrl, templateStyle: cardStyles?.away ?? templateStyle },
        },
      };
    }
  }

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
    ...publishable(record),
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
    where: { status: "DRAFT", ...WITHOUT_SCHEDULE_PLACEHOLDERS },
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
    where: { fixtureId: { in: fixtureIds }, status: { in: ["DRAFT", "APPROVED"] }, ...WITHOUT_SCHEDULE_PLACEHOLDERS },
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
