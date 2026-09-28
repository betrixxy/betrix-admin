import type { Metadata } from "next";
import { AdBudgetPanel } from "@/components/features/dashboard/ad-budget-panel";
import { AnalyticsSummary } from "@/components/features/dashboard/analytics-summary";
import { ApiConnections } from "@/components/features/dashboard/api-connections";
import { EditMetricsSheet } from "@/components/features/dashboard/edit-metrics-sheet";
import { PageHeader } from "@/components/features/dashboard/page-header";
import { PlatformPerformanceTable } from "@/components/features/dashboard/platform-performance";
import { TopPostsTable } from "@/components/features/dashboard/top-posts-table";
import { getAdBudgetOverview } from "@/lib/dashboard/ad-budget-data";
import { getAnalyticsData } from "@/lib/dashboard/analytics-data";
import { getPostById } from "@/lib/dashboard/calendar-data";
import { getFixtureLabels } from "@/lib/dashboard/fixtures";
import { ANALYTICS_SORTS, type AnalyticsSort } from "@/types/social";

export const metadata: Metadata = {
  title: "Etkileşim & Reklam — betrix.pro",
  description: "Gönderi performansı, etkileşim oranları ve reklam paneli",
};

// Veritabanından okunan canlı veri — statik önbelleğe alınmaz (bkz. CLAUDE.md 1.5).
export const dynamic = "force-dynamic";

interface AnalyticsPageProps {
  searchParams: Promise<{ sort?: string | string[]; metrics?: string | string[] }>;
}

function parseSort(param: string | string[] | undefined): AnalyticsSort {
  return ANALYTICS_SORTS.find((sort) => sort === param) ?? "engagement";
}

const sortHref = (sort: AnalyticsSort) => `/dashboard/analytics?sort=${sort}`;

export default async function AnalyticsPage({ searchParams }: AnalyticsPageProps) {
  const params = await searchParams;
  const sort = parseSort(params.sort);
  const metricsId = typeof params.metrics === "string" ? params.metrics : undefined;

  const [data, adBudget, metricsPost] = await Promise.all([
    getAnalyticsData(sort),
    getAdBudgetOverview(),
    metricsId ? getPostById(metricsId) : Promise.resolve(null),
  ]);
  const fixtureLabels = await getFixtureLabels();

  return (
    <>
      <PageHeader
        title="Etkileşim ve Reklam Paneli"
        description="Yayınlanan içeriklerin performansı: izlenme, beğeni, yorum, paylaşım ve checkmatch.net'e giden tıklamalar. Meta ve TikTok API'leri bağlanana kadar metrikler elle girilir."
      />

      <AnalyticsSummary overview={data.overview} />

      <TopPostsTable
        items={data.topPosts}
        sort={sort}
        fixtureLabels={fixtureLabels}
        sortHref={sortHref}
        metricsHref={(postId) => `/dashboard/analytics?sort=${sort}&metrics=${postId}`}
      />

      <AdBudgetPanel overview={adBudget} fixtureLabels={fixtureLabels} />

      <div className="grid gap-6 xl:grid-cols-2">
        <PlatformPerformanceTable platforms={data.platforms} />
        <ApiConnections />
      </div>

      {metricsPost ? (
        <EditMetricsSheet
          key={metricsPost.id}
          post={metricsPost}
          postLabel={fixtureLabels[metricsPost.fixtureId] ?? metricsPost.fixtureId}
          closeHref={sortHref(sort)}
        />
      ) : null}
    </>
  );
}
