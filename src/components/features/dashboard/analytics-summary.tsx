import { Bookmark, Eye, Heart, MessageCircle, MousePointerClick, Share2, TrendingUp, Users } from "lucide-react";
import { formatCompactNumber, formatNumber, formatPercent } from "@/lib/dashboard/format";
import type { AnalyticsOverview } from "@/types/social";
import { StatCard } from "./stat-card";

export function AnalyticsSummary({ overview }: { overview: AnalyticsOverview }) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <StatCard
        label="Toplam İzlenme"
        value={formatCompactNumber(overview.totalViews)}
        hint={`${formatNumber(overview.publishedCount)} yayınlanmış gönderi`}
        icon={Eye}
        accentClassName="bg-sky-500/15 text-sky-400"
      />
      <StatCard
        label="Erişim"
        value={formatCompactNumber(overview.totalReach)}
        hint="Gönderiyi gören tekil hesap"
        icon={Users}
        accentClassName="bg-indigo-500/15 text-indigo-400"
      />
      <StatCard
        label="Etkileşim Oranı"
        value={formatPercent(overview.engagementRate)}
        hint="(beğeni + yorum + paylaşım + kaydetme) / erişim"
        icon={TrendingUp}
      />
      <StatCard
        label="Link Tıklaması"
        value={formatCompactNumber(overview.totalClicks)}
        hint={`Tıklama oranı ${formatPercent(overview.clickThroughRate)}`}
        icon={MousePointerClick}
        accentClassName="bg-violet-500/15 text-violet-400"
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
        label="Kaydetme"
        value={formatCompactNumber(overview.totalSaves)}
        hint="İçeriğin kalıcı değer sinyali"
        icon={Bookmark}
        accentClassName="bg-amber-500/15 text-amber-400"
      />
    </div>
  );
}
