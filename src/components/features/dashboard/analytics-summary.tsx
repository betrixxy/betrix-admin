import { Eye, Heart, MessageCircle, MousePointerClick, Share2, TrendingUp } from "lucide-react";
import { formatCompactNumber, formatNumber, formatPercent } from "@/lib/dashboard/format";
import type { AnalyticsOverview } from "@/types/social";
import { StatCard } from "./stat-card";

export function AnalyticsSummary({ overview }: { overview: AnalyticsOverview }) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 2xl:grid-cols-6">
      <StatCard
        label="Toplam İzlenme"
        value={formatCompactNumber(overview.totalViews)}
        hint={`${formatNumber(overview.publishedCount)} yayınlanmış gönderi`}
        icon={Eye}
        accentClassName="bg-sky-500/15 text-sky-400"
      />
      <StatCard
        label="Etkileşim Oranı"
        value={formatPercent(overview.engagementRate)}
        hint="(beğeni + yorum + paylaşım) / izlenme"
        icon={TrendingUp}
      />
      <StatCard
        label="Beğeni"
        value={formatCompactNumber(overview.totalLikes)}
        icon={Heart}
        accentClassName="bg-pink-500/15 text-pink-400"
      />
      <StatCard
        label="Yorum"
        value={formatCompactNumber(overview.totalComments)}
        icon={MessageCircle}
        accentClassName="bg-cyan-500/15 text-cyan-400"
      />
      <StatCard
        label="Paylaşım"
        value={formatCompactNumber(overview.totalShares)}
        icon={Share2}
        accentClassName="bg-orange-500/15 text-orange-400"
      />
      <StatCard
        label="Link Tıklaması"
        value={formatCompactNumber(overview.totalClicks)}
        hint={`Tıklama oranı ${formatPercent(overview.clickThroughRate)}`}
        icon={MousePointerClick}
        accentClassName="bg-violet-500/15 text-violet-400"
      />
    </div>
  );
}
