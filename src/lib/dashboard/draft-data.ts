import { format } from "date-fns";
import { z } from "zod";
import { WITHOUT_SCHEDULE_PLACEHOLDERS } from "@/lib/calendar/content-schedule";
import { parseRenderOptions, parseStatsSnapshot } from "@/lib/dashboard/draft-snapshot";
import { drawRecordOptionsSchema } from "@/lib/dashboard/draw-records";
import { PLATFORM_LABELS } from "@/lib/dashboard/social-meta";
import { prisma } from "@/lib/prisma";
import { APPROVED_STATUSES, STUDIO_FORMATS, type StudioFormat, type StudioPostOption } from "@/types/ai-content";
import { parsePublishSettings, publishMediaOf } from "@/lib/dashboard/publish-caption";
import type { DraftLookup, DraftSummary, DraftView, PublishableDraft } from "@/types/draft";
import { PUBLISH_PLATFORMS } from "@/types/publishing";
import { DEFAULT_LINEUP_TEMPLATE_STYLE, LINEUP_TEMPLATE_STYLES } from "@/types/lineup";
import { MATCH_DAY_FORMAT_IDS, type MatchDayFormatId } from "@/types/match-day";
import { DEFAULT_SOCIAL_FORMAT, SOCIAL_FORMAT_IDS, type SocialFormatId } from "@/types/studio-formats";

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

/** `AiContent.renderOptions` — maç önü vitrin kaydı (inceleme ekranı yalnızca görseli ve başlığı okur). */
const vitrinViewSchema = z.object({
  kind: z.literal("VITRIN"),
  format: z.enum(MATCH_DAY_FORMAT_IDS),
  imageUrl: z.string(),
  title: z.string(),
  subtitle: z.string(),
  // 01 Poster + 02 Analiz (2026-10-19 tasarımı); eski tek kartlı kayıtlarda yok.
  carousel: z.array(z.object({ url: z.string(), label: z.string() })).optional(),
});
/** `AiContent.renderOptions` — Oyuncu Karşılaştırması (01 Poster + 02 İstatistikler). */
const h2hViewSchema = z.object({
  kind: z.literal("PLAYER_H2H"),
  format: z.enum(MATCH_DAY_FORMAT_IDS),
  imageUrl: z.string(),
  title: z.string(),
  subtitle: z.string(),
  carousel: z.array(z.object({ url: z.string(), label: z.string() })),
});
const VITRIN_SOCIAL_FORMAT: Record<MatchDayFormatId, SocialFormatId> = { IG_PORTRAIT: "post", IG_SQUARE: "square", STORY: "story", X_LANDSCAPE: "landscape" };

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

/** `AiContent.renderOptions` — Maç Sonucu kaydı (yalnızca inceleme ekranının okuduğu alanlar). */
const slideSchema = z.object({ url: z.string(), label: z.string() });
const matchResultOptionsSchema = z.object({
  kind: z.enum(["MATCH_RESULT", "MATCH_STATS"]),
  format: formatField,
  imageUrl: z.string(),
  title: z.string(),
  subtitle: z.string(),
  mvp: z.object({ name: z.string() }).nullish(),
  carousel: z.array(slideSchema).optional(),
});

/** Yayın Merkezi alanları — görseller ve kayıtlı yayın ayarları doğrudan kayıttan okunur. */
function publishable(record: {
  renderOptions: unknown;
  resultImageUrl: string | null;
  publishedPlatform: string | null;
  publishedPostId: string | null;
  publishedUrl: string | null;
  publishedAt: Date | null;
}): PublishableDraft {
  const platform = PUBLISH_PLATFORMS.find((candidate) => candidate === record.publishedPlatform);
  const published =
    platform && record.publishedUrl && record.publishedAt
      ? { platform, url: record.publishedUrl, postId: record.publishedPostId ?? "", at: record.publishedAt.toISOString() }
      : null;
  return { media: publishMediaOf(record.renderOptions, record.resultImageUrl), publish: parsePublishSettings(record.renderOptions), published };
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

  if (record.contentType === "DRAWS_AND_PAIRINGS") {
    const draw = drawRecordOptionsSchema.safeParse(record.renderOptions);
    if (draw.success) {
      const { imageUrl, title, subtitle, format, carousel } = draw.data;
      return {
        kind: "match-result",
        draft: {
          id: record.id,
          fixtureId: record.fixtureId,
          status: record.status,
          caption: record.caption ?? "",
          postId: record.postId,
          reviewedAt: record.reviewedAt?.toISOString() ?? null,
          ...publishable(record),
          title,
          subtitle,
          kindLabel: "Kura Sonucu",
          mvpName: null,
          imageUrl,
          slides: carousel && carousel.length > 0 ? carousel : [{ url: imageUrl, label: "Kura Sonucu" }],
          format: VITRIN_SOCIAL_FORMAT[format],
          // Yayın akışı normal; gönderi metninde bahis dili uyarısı (vitrin gibi tahmin kaydı yok).
          vitrin: false,
          languageGate: true,
          slug: "kura",
        },
      };
    }
  }

  if (record.contentType === "AI_MARKET_PREDICTION") {
    const vitrin = vitrinViewSchema.safeParse(record.renderOptions);
    if (vitrin.success) {
      const { imageUrl, title, subtitle, format, carousel } = vitrin.data;
      return {
        kind: "match-result",
        draft: {
          id: record.id,
          fixtureId: record.fixtureId,
          status: record.status,
          caption: record.caption ?? "",
          postId: record.postId,
          reviewedAt: record.reviewedAt?.toISOString() ?? null,
          ...publishable(record),
          title,
          subtitle,
          kindLabel: "Maç Önü Analiz",
          mvpName: null,
          imageUrl,
          slides: carousel && carousel.length > 0 ? carousel : [{ url: imageUrl, label: "Maç Önü Analiz" }],
          format: VITRIN_SOCIAL_FORMAT[format],
          vitrin: true,
          languageGate: true,
          slug: "mac-onu",
        },
      };
    }
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

  if (record.contentType === "PLAYER_H2H") {
    const h2h = h2hViewSchema.safeParse(record.renderOptions);
    if (h2h.success) {
      const { imageUrl, title, subtitle, format, carousel } = h2h.data;
      return {
        kind: "match-result",
        draft: {
          id: record.id,
          fixtureId: record.fixtureId,
          status: record.status,
          caption: record.caption ?? "",
          postId: record.postId,
          reviewedAt: record.reviewedAt?.toISOString() ?? null,
          ...publishable(record),
          title,
          subtitle,
          kindLabel: "Oyuncu Karşılaştırması",
          mvpName: null,
          imageUrl,
          slides: carousel,
          format: VITRIN_SOCIAL_FORMAT[format],
          // Tahmin kaydı yok (vitrin akışı değil): yayın akışı normal, gönderi metninde bahis dili uyarısı.
          vitrin: false,
          languageGate: true,
          slug: "oyuncu-karsilastirma",
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

  if (record.contentType === "MATCH_RESULT" || record.contentType === "MATCH_STATS") {
    const options = matchResultOptionsSchema.safeParse(record.renderOptions);
    if (options.success) {
      const { imageUrl, title, subtitle, mvp, format, carousel, kind } = options.data;
      const kindLabel = kind === "MATCH_STATS" ? "Maç İstatistikleri" : "Maç Sonucu";
      return {
        kind: "match-result",
        draft: {
          id: record.id,
          fixtureId: record.fixtureId,
          status: record.status,
          caption: record.caption ?? "",
          postId: record.postId,
          reviewedAt: record.reviewedAt?.toISOString() ?? null,
          ...publishable(record),
          title,
          subtitle,
          kindLabel,
          mvpName: mvp?.name ?? null,
          imageUrl,
          slides: carousel && carousel.length > 0 ? carousel : [{ url: imageUrl, label: kindLabel }],
          format,
          vitrin: false,
          languageGate: false,
          slug: "mac-sonucu",
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
    where: { fixtureId: { in: fixtureIds }, status: { in: ["DRAFT", ...APPROVED_STATUSES] }, ...WITHOUT_SCHEDULE_PLACEHOLDERS },
    _count: { _all: true },
  });

  const counts: Record<string, FixtureDraftCounts> = {};
  for (const group of groups) {
    const entry = (counts[group.fixtureId] ??= { drafts: 0, approved: 0 });
    if (group.status === "DRAFT") entry.drafts = group._count._all;
    else entry.approved += group._count._all;
  }
  return counts;
}
