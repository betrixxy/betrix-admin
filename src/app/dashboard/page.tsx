import type { Metadata } from "next";
import { startOfWeek } from "date-fns";
import { BarChart3, CalendarDays, Globe, Sparkles } from "lucide-react";
import { ModuleSummaryCard } from "@/components/features/dashboard/module-summary-card";
import {
  BestPostLine,
  RecentRenders,
  UpcomingPostsList,
  VisitsSparkbars,
} from "@/components/features/dashboard/overview-panels";
import { PageHeader } from "@/components/features/dashboard/page-header";
import { getAnalyticsData } from "@/lib/dashboard/analytics-data";
import { getCalendarSummary, getPostsInRange, getUpcomingPosts } from "@/lib/dashboard/calendar-data";
import { getFixtureLabels } from "@/lib/dashboard/fixtures";
import { formatCompactNumber, formatNumber, formatPercent } from "@/lib/dashboard/format";
import { getAiContentCount, getRecentAiContent } from "@/lib/dashboard/studio-data";
import { getTrafficData } from "@/lib/dashboard/traffic-data";

export const metadata: Metadata = {
  title: "Dashboard — betrix.pro",
  description: "İçerik takvimi, performans, AI stüdyosu ve web trafiği özeti",
};

// Veritabanından okunan canlı veri — statik önbelleğe alınmaz (bkz. CLAUDE.md 1.5).
export const dynamic = "force-dynamic";

const UPCOMING_LIMIT = 3;
const RECENT_RENDERS_LIMIT = 4;

export default async function DashboardPage() {
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000 - 1);

  const [calendar, upcoming, weekPosts, analytics, aiCount, recentRenders, traffic] = await Promise.all([
    getCalendarSummary(),
    getUpcomingPosts(UPCOMING_LIMIT),
    getPostsInRange(weekStart, weekEnd),
    getAnalyticsData("engagement"),
    getAiContentCount(),
    getRecentAiContent(RECENT_RENDERS_LIMIT),
    getTrafficData(7, "day"),
  ]);
  const fixtureLabels = await getFixtureLabels();

  return (
    <>
      <PageHeader
        title="Genel Bakış"
        description="İçerik takvimi, gönderi performansı, AI stüdyosu ve checkmatch.net trafiğinin özeti — ayrıntı için ilgili modüle geçin."
      />

      <div className="grid gap-6 xl:grid-cols-2">
        <ModuleSummaryCard
          title="İçerik Üretim Takvimi"
          description="Planlanan ve paylaşılan gönderiler"
          href="/dashboard/calendar"
          icon={CalendarDays}
          accentClassName="bg-emerald-500/15 text-emerald-400"
          metrics={[
            { label: "Hazırlanıyor", value: formatNumber(calendar.preparingCount) },
            { label: "Paylaşıldı", value: formatNumber(calendar.publishedCount) },
            { label: "Bu hafta", value: formatNumber(weekPosts.length) },
          ]}
        >
          <UpcomingPostsList posts={upcoming} fixtureLabels={fixtureLabels} />
        </ModuleSummaryCard>

        <ModuleSummaryCard
          title="Etkileşim ve Reklam"
          description="Gönderi performansı"
          href="/dashboard/analytics"
          icon={BarChart3}
          accentClassName="bg-sky-500/15 text-sky-400"
          metrics={[
            { label: "İzlenme", value: formatCompactNumber(analytics.overview.totalViews) },
            { label: "Etkileşim oranı", value: formatPercent(analytics.overview.engagementRate) },
            { label: "Link tıklaması", value: formatCompactNumber(analytics.overview.totalClicks) },
          ]}
        >
          <BestPostLine item={analytics.topPosts[0]} fixtureLabels={fixtureLabels} />
        </ModuleSummaryCard>

        <ModuleSummaryCard
          title="AI İçerik Stüdyosu"
          description="Fal.ai ile üretilen görseller"
          href="/dashboard/studio"
          icon={Sparkles}
          accentClassName="bg-violet-500/15 text-violet-400"
          metrics={[{ label: "Üretilen görsel", value: formatNumber(aiCount) }]}
        >
          <RecentRenders items={recentRenders} />
        </ModuleSummaryCard>

        <ModuleSummaryCard
          title="Web Trafiği"
          description="checkmatch.net — son 7 gün"
          href="/dashboard/traffic"
          icon={Globe}
          accentClassName="bg-pink-500/15 text-pink-400"
          metrics={[
            { label: "Ziyaret", value: formatCompactNumber(traffic.totals.visits) },
            { label: "Tekil ziyaretçi", value: formatCompactNumber(traffic.totals.uniques) },
            { label: "Sosyal payı", value: formatPercent(traffic.totals.socialShare) },
          ]}
        >
          <VisitsSparkbars series={traffic.series} />
        </ModuleSummaryCard>
      </div>
    </>
  );
}
