import type { Metadata } from "next";
import { PageHeader } from "@/components/features/dashboard/page-header";
import { PlanList } from "@/components/features/dashboard/plan-list";
import { getPlanPage, planStartDay } from "@/lib/dashboard/plan-data";

export const metadata: Metadata = {
  title: "İçerik Planı — betrix.pro",
  description: "Yıldızlı maçlar ve içerik paketlerinin hazırlık durumu",
};

// Veritabanı + canlı skor — statik önbelleğe alınmaz (bkz. CLAUDE.md 1.5).
export const dynamic = "force-dynamic";

/**
 * İçerik Planı — eski "İçerik Takvimi" (SocialPost planlama) ve "Fikstür CRM" (ay ızgarası)
 * sayfalarının yerini alır; iki eski adres buraya yönlenir (next.config.ts). Veriler silinmedi:
 * gönderiler Gönderiler'de, içerik planları ve reklam bütçeleri veritabanında durur.
 */
export default async function PlanPage() {
  const now = new Date();
  const initial = await getPlanPage(planStartDay(now), now);
  return (
    <>
      <PageHeader
        title="İçerik Planı"
        description="Yalnızca yıldızlı maçlar — dünden itibaren gün gün. Her satırda maçın içerik paketinin hazırlık durumu: onaylı kartlar / aktif içerik türleri ve onay bekleyen taslaklar. Maç Merkezi'nde ☆ ile maç ekleyin."
      />
      <PlanList initial={initial} />
    </>
  );
}
