import type { Metadata } from "next";
import { AdBudgetPanel } from "@/components/features/dashboard/ad-budget-panel";
import type { AnalyticsFilterState } from "@/components/features/dashboard/analytics-filters";
import { AnalyticsSummary } from "@/components/features/dashboard/analytics-summary";
import { ApiConnections } from "@/components/features/dashboard/api-connections";
import { ConnectStatusBanner, type ConnectStatus } from "@/components/features/dashboard/connect-status-banner";
import { ContentInsightsCard } from "@/components/features/dashboard/content-insights";
import { EditMetricsSheet } from "@/components/features/dashboard/edit-metrics-sheet";
import { PageHeader } from "@/components/features/dashboard/page-header";
import { PlatformPerformanceTable } from "@/components/features/dashboard/platform-performance";
import { TopPostsTable } from "@/components/features/dashboard/top-posts-table";
import { getAdBudgetOverview } from "@/lib/dashboard/ad-budget-data";
import { getAnalyticsData } from "@/lib/dashboard/analytics-data";
import { getPostById } from "@/lib/dashboard/calendar-data";
import { getFixtureLabels } from "@/lib/dashboard/fixtures";
import { getIntegrationStatuses } from "@/lib/dashboard/integrations";
import { socialUseMocks } from "@/lib/env";
import { SLUG_TO_PLATFORM, parsePlatformSlug } from "@/lib/services/social/platforms";
import { ANALYTICS_SORTS, type AnalyticsSort } from "@/types/social";
import { CONNECT_ERROR_CODES } from "@/types/social-connection";

export const metadata: Metadata = {
  title: "Etkileşim & Reklam — betrix.pro",
  description: "Gönderi performansı, etkileşim oranları ve reklam paneli",
};

// Veritabanından okunan canlı veri — statik önbelleğe alınmaz (bkz. CLAUDE.md 1.5).
export const dynamic = "force-dynamic";

type Param = string | string[] | undefined;

interface AnalyticsPageProps {
  searchParams: Promise<{
    sort?: Param;
    platform?: Param;
    metrics?: Param;
    connected?: Param;
    connect_error?: Param;
  }>;
}

function parseSort(param: Param): AnalyticsSort {
  return ANALYTICS_SORTS.find((sort) => sort === param) ?? "engagement";
}

function parseConnectStatus(connected: Param, error: Param, platform: Param): ConnectStatus | null {
  const connectedSlug = parsePlatformSlug(connected);
  if (connectedSlug) return { kind: "connected", slug: connectedSlug };
  const slug = parsePlatformSlug(platform);
  const code = CONNECT_ERROR_CODES.find((value) => value === error);
  return slug && code ? { kind: "error", slug, code } : null;
}

export default async function AnalyticsPage({ searchParams }: AnalyticsPageProps) {
  const params = await searchParams;
  const filters: AnalyticsFilterState = { sort: parseSort(params.sort), platform: parsePlatformSlug(params.platform) };
  const metricsId = typeof params.metrics === "string" ? params.metrics : undefined;
  // Hata dönüşünde `platform` hangi bağlantının başarısız olduğunu belirtir, filtre değildir.
  const connectStatus = parseConnectStatus(params.connected, params.connect_error, params.platform);
  if (connectStatus?.kind === "error") filters.platform = null;

  const href = (patch: Partial<AnalyticsFilterState> = {}, extra: Record<string, string> = {}) => {
    const next = { ...filters, ...patch };
    const query = new URLSearchParams({ sort: next.sort, ...(next.platform ? { platform: next.platform } : {}), ...extra });
    return `/dashboard/analytics?${query.toString()}`;
  };

  const [data, adBudget, integrations, metricsPost] = await Promise.all([
    getAnalyticsData(filters.sort, filters.platform ? SLUG_TO_PLATFORM[filters.platform] : null),
    getAdBudgetOverview(),
    getIntegrationStatuses(),
    metricsId ? getPostById(metricsId) : Promise.resolve(null),
  ]);
  const fixtureLabels = await getFixtureLabels();

  return (
    <>
      <PageHeader
        title="Etkileşim ve Reklam Paneli"
        description="Yayınlanan içeriklerin performansı: izlenme, erişim, beğeni, yorum, paylaşım, kaydetme ve checkmatch.net'e giden tıklamalar. Bağlı hesaplardan otomatik çekilir; bağlı olmayan platformlarda elle girilir."
      />

      {connectStatus ? <ConnectStatusBanner status={connectStatus} /> : null}

      <AnalyticsSummary overview={data.overview} />

      <TopPostsTable
        items={data.topPosts}
        sort={filters.sort}
        platform={filters.platform}
        fixtureLabels={fixtureLabels}
        href={href}
        metricsHref={(postId) => href({}, { metrics: postId })}
      />

      <ContentInsightsCard insights={data.insights} />

      <AdBudgetPanel overview={adBudget} fixtureLabels={fixtureLabels} />

      <div className="grid gap-6 xl:grid-cols-2">
        <PlatformPerformanceTable platforms={data.platforms} />
        <ApiConnections integrations={integrations} mockMode={socialUseMocks} />
      </div>

      {metricsPost ? (
        <EditMetricsSheet
          key={metricsPost.id}
          post={metricsPost}
          postLabel={fixtureLabels[metricsPost.fixtureId] ?? metricsPost.fixtureId}
          closeHref={href()}
        />
      ) : null}
    </>
  );
}
