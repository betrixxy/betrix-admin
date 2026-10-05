import { format } from "date-fns";
import { prisma } from "@/lib/prisma";
import { WITHOUT_SCHEDULE_PLACEHOLDERS } from "@/lib/calendar/content-schedule";
import { getFixtureLabels } from "@/lib/dashboard/fixtures";
import { PLATFORM_LABELS } from "@/lib/dashboard/social-meta";
import type { AiContentStatus, AiContentView, StudioPostOption } from "@/types/ai-content";

const RECENT_AI_CONTENT_LIMIT = 12;

export interface StudioData {
  recent: AiContentView[];
  totalCount: number;
  /** Üretilen görselin bağlanabileceği, henüz paylaşılmamış gönderiler. */
  postOptions: StudioPostOption[];
  /** fixtureId -> "Ev – Deplasman" etiketi (bkz. `lib/dashboard/fixtures.ts`). */
  fixtureLabels: Record<string, string>;
}

function toAiContentView(row: {
  id: string;
  fixtureId: string;
  postId: string | null;
  prompt: string;
  playerImageUrl: string | null;
  logoImageUrl: string | null;
  resultImageUrl: string | null;
  status: AiContentStatus;
  createdAt: Date;
}): AiContentView {
  return {
    id: row.id,
    fixtureId: row.fixtureId,
    postId: row.postId,
    prompt: row.prompt,
    playerImageUrl: row.playerImageUrl,
    logoImageUrl: row.logoImageUrl,
    resultImageUrl: row.resultImageUrl,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function getRecentAiContent(limit: number): Promise<AiContentView[]> {
  const rows = await prisma.aiContent.findMany({ where: WITHOUT_SCHEDULE_PLACEHOLDERS, orderBy: { createdAt: "desc" }, take: limit });
  return rows.map(toAiContentView);
}

export async function getAiContentCount(): Promise<number> {
  return prisma.aiContent.count({ where: WITHOUT_SCHEDULE_PLACEHOLDERS });
}

export async function getStudioData(): Promise<StudioData> {
  const [recent, totalCount, posts] = await Promise.all([
    getRecentAiContent(RECENT_AI_CONTENT_LIMIT),
    getAiContentCount(),
    prisma.socialPost.findMany({
      where: { status: "PREPARING" },
      include: { platform: true },
      orderBy: { scheduledFor: "asc" },
      take: 50,
    }),
  ]);

  const fixtureLabels = await getFixtureLabels();
  const postOptions = posts.map((post) => ({
    id: post.id,
    label: `${PLATFORM_LABELS[post.platform.type]} · ${fixtureLabels[post.fixtureId] ?? post.fixtureId} · ${format(post.scheduledFor, "d MMM HH:mm")}`,
  }));

  return { recent, totalCount, postOptions, fixtureLabels };
}
