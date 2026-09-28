import type { Metadata } from "next";
import { Eye, Fingerprint, Share2, Users } from "lucide-react";
import { PageHeader } from "@/components/features/dashboard/page-header";
import { RecentVisitsTable } from "@/components/features/dashboard/recent-visits-table";
import { StatCard } from "@/components/features/dashboard/stat-card";
import { TopPagesChart, TrafficSourcesChart, VisitorsChart } from "@/components/features/dashboard/traffic-charts";
import { TrafficControls } from "@/components/features/dashboard/traffic-controls";
import { formatCompactNumber, formatPercent } from "@/lib/dashboard/format";
import { getTrafficData } from "@/lib/dashboard/traffic-data";
import { TRAFFIC_GRANULARITIES, TRAFFIC_RANGES, type TrafficGranularity, type TrafficRange } from "@/types/traffic";

export const metadata: Metadata = {
  title: "Web Trafiği — betrix.pro",
  description: "checkmatch.net ziyaretçi trafiği: günlük/haftalık ziyaretçi, en çok girilen sayfalar ve trafik kaynakları",
};

// Veritabanından okunan canlı veri — statik önbelleğe alınmaz (bkz. CLAUDE.md 1.5).
export const dynamic = "force-dynamic";

interface TrafficPageProps {
  searchParams: Promise<{ range?: string | string[]; by?: string | string[] }>;
}

function parseRange(param: string | string[] | undefined): TrafficRange {
  return TRAFFIC_RANGES.find((range) => String(range) === param) ?? 30;
}

function parseGranularity(param: string | string[] | undefined): TrafficGranularity {
  return TRAFFIC_GRANULARITIES.find((granularity) => granularity === param) ?? "day";
}

export default async function TrafficPage({ searchParams }: TrafficPageProps) {
  const params = await searchParams;
  const range = parseRange(params.range);
  const granularity = parseGranularity(params.by);
  const data = await getTrafficData(range, granularity);

  return (
    <>
      <PageHeader
        title="Web Trafik Analizi"
        description="checkmatch.net'in ziyaretçi trafiği: ne kadar ziyaretçi geliyor, hangi sayfalar en çok giriliyor ve trafik hangi kaynaktan geliyor. Sponsor ve reklam verenlere sunulacak kanıtlı veri burada toplanır."
        actions={<TrafficControls range={range} granularity={granularity} />}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Toplam Ziyaret" value={formatCompactNumber(data.totals.visits)} hint={`Son ${range} gün`} icon={Eye} />
        <StatCard
          label="Tekil Ziyaretçi"
          value={formatCompactNumber(data.totals.uniques)}
          icon={Users}
          accentClassName="bg-violet-500/15 text-violet-400"
        />
        <StatCard
          label="Benzersiz Oturum"
          value={formatCompactNumber(data.totals.sessions)}
          icon={Fingerprint}
          accentClassName="bg-sky-500/15 text-sky-400"
        />
        <StatCard
          label="Sosyal Medya Payı"
          value={formatPercent(data.totals.socialShare)}
          hint="Gönderilerden gelen ziyaret oranı"
          icon={Share2}
          accentClassName="bg-pink-500/15 text-pink-400"
        />
      </div>

      <VisitorsChart series={data.series} granularity={granularity} />

      <div className="grid gap-6 xl:grid-cols-2">
        <TopPagesChart pages={data.topPages} />
        <TrafficSourcesChart sources={data.sources} />
      </div>

      <RecentVisitsTable visits={data.recent} />
    </>
  );
}
