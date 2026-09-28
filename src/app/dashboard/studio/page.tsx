import type { Metadata } from "next";
import { AlertTriangle } from "lucide-react";
import { AiContentGallery } from "@/components/features/dashboard/ai-content-gallery";
import { PageHeader } from "@/components/features/dashboard/page-header";
import { StudioForm } from "@/components/features/dashboard/studio-form";
import { getFixtureOptions } from "@/lib/dashboard/fixtures";
import { getStudioData } from "@/lib/dashboard/studio-data";
import { isFalConfigured } from "@/lib/services/fal";

export const metadata: Metadata = {
  title: "AI İçerik Stüdyosu — betrix.pro",
  description: "Fal.ai ile maç istatistiklerinden otomatik post görselleri üretin",
};

// Veritabanından okunan canlı veri — statik önbelleğe alınmaz (bkz. CLAUDE.md 1.5).
export const dynamic = "force-dynamic";

export default async function StudioPage() {
  const [data, falConfigured] = await Promise.all([getStudioData(), Promise.resolve(isFalConfigured())]);

  return (
    <>
      <PageHeader
        title="Yapay Zeka İçerik Stüdyosu"
        description="Oyuncu fotoğrafı ve logonuzu yükleyin, özel prompt yazın; maç istatistikleriyle birleştirilen post görseli Fal.ai ile üretilir. Üretilen her görsel kayıt altına alınır."
      />

      {!falConfigured ? (
        <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>
            <code className="rounded bg-black/20 px-1 py-0.5 text-xs">FAL_KEY</code> tanımlı değil — görsel üretimi
            devre dışı. Aktif etmek için <code className="rounded bg-black/20 px-1 py-0.5 text-xs">.env.local</code>{" "}
            dosyasına Fal.ai API anahtarınızı ekleyip sunucuyu yeniden başlatın.
          </span>
        </div>
      ) : null}

      <StudioForm fixtures={getFixtureOptions()} postOptions={data.postOptions} disabled={!falConfigured} />
      <AiContentGallery items={data.recent} totalCount={data.totalCount} fixtureLabels={data.fixtureLabels} />
    </>
  );
}
