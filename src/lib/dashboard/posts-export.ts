import type { CsvValue } from "@/lib/dashboard/csv";
import { istanbulDay } from "@/lib/metrics/istanbul-time";
import { engagementPerFollower, engagementRateByReach, firstHourVelocity, interactionsOf } from "@/lib/metrics/post-performance";
import { POST_METRIC_FIELDS, type PostMetricValues } from "@/types/post-metrics";

/**
 * "Veriyi indir (CSV)": tüm gönderiler, analiz özellikleri ve en güncel metrikleriyle — saf satır üretimi.
 * Türetilmiş oranlar burada hesaplanır (saklanmaz).
 */

export interface PostExportFeatures {
  publishedHourIst: number;
  weekdayIst: number;
  hoursFromKickoff: number | null;
  contentType: string | null;
  format: string | null;
  templateName: string | null;
  mediaCount: number;
  captionChars: number;
  captionWords: number;
  hasQuestion: boolean;
  emojiCount: number;
  hashtags: string[];
  linkPlacement: string;
  league: string | null;
  homeTeam: string | null;
  awayTeam: string | null;
  isDerby: boolean | null;
  followersAtPublish: number | null;
  playbookVersion: string | null;
  captionModel: string | null;
  captionVariant: string | null;
}

export interface PostExportInput {
  id: string;
  platform: string;
  source: string;
  publishedAt: Date | null;
  permalink: string | null;
  mediaType: string | null;
  caption: string;
  features: PostExportFeatures | null;
  latest: (PostMetricValues & { capturedAt: Date; ageHours: number; metricLevel: string | null }) | null;
  snapshots: (PostMetricValues & { ageHours: number })[];
  /** Kısa link tıklaması ve siteye gelen tekil ziyaretçi (bkz. §6). */
  site: { linkClicks: number; uniqueVisitors: number; sessions: number } | null;
}

const FEATURE_HEADERS = [
  "hour_ist",
  "weekday_ist",
  "hours_from_kickoff",
  "content_type",
  "format",
  "template",
  "media_count",
  "caption_chars",
  "caption_words",
  "has_question",
  "emoji_count",
  "hashtags",
  "link_placement",
  "league",
  "home_team",
  "away_team",
  "is_derby",
  "followers_at_publish",
  "playbook_version",
  "caption_model",
  "caption_variant",
] as const;

const snake = (field: string) => field.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);

export const POST_CSV_HEADERS = [
  "post_id",
  "platform",
  "source",
  "published_at_utc",
  "published_day_ist",
  "media_type",
  "permalink",
  ...FEATURE_HEADERS,
  ...POST_METRIC_FIELDS.map(snake),
  "metric_level",
  "metrics_captured_at",
  "metrics_age_hours",
  "interactions",
  "engagement_rate_reach",
  "engagement_per_follower",
  "first_hour_velocity",
  "short_link_clicks",
  "site_unique_visitors",
  "site_sessions",
  "caption",
] as const;

function featureCells(features: PostExportFeatures | null): CsvValue[] {
  if (!features) return FEATURE_HEADERS.map(() => null);
  return [
    features.publishedHourIst,
    features.weekdayIst,
    features.hoursFromKickoff,
    features.contentType,
    features.format,
    features.templateName,
    features.mediaCount,
    features.captionChars,
    features.captionWords,
    features.hasQuestion,
    features.emojiCount,
    features.hashtags,
    features.linkPlacement,
    features.league,
    features.homeTeam,
    features.awayTeam,
    features.isDerby,
    features.followersAtPublish,
    features.playbookVersion,
    features.captionModel,
    features.captionVariant,
  ];
}

export function postCsvRow(input: PostExportInput): CsvValue[] {
  const latest = input.latest;
  return [
    input.id,
    input.platform,
    input.source,
    input.publishedAt,
    input.publishedAt ? istanbulDay(input.publishedAt) : null,
    input.mediaType,
    input.permalink,
    ...featureCells(input.features),
    ...POST_METRIC_FIELDS.map((field) => latest?.[field] ?? null),
    latest?.metricLevel ?? null,
    latest?.capturedAt ?? null,
    latest?.ageHours ?? null,
    latest ? interactionsOf(latest) : null,
    latest ? engagementRateByReach(latest) : null,
    latest ? engagementPerFollower(latest, input.features?.followersAtPublish ?? null) : null,
    firstHourVelocity(input.snapshots),
    input.site?.linkClicks ?? null,
    input.site?.uniqueVisitors ?? null,
    input.site?.sessions ?? null,
    input.caption,
  ];
}
