import type { Metadata } from "next";
import { FileDown } from "lucide-react";
import { PageHeader } from "@/components/features/dashboard/page-header";
import { ImportPostsForm } from "@/components/features/dashboard/posts/import-posts-form";
import { PostListFiltersForm } from "@/components/features/dashboard/posts/post-list-filters";
import { PostListTable } from "@/components/features/dashboard/posts/post-list-table";
import { RefreshMetricsButton } from "@/components/features/dashboard/posts/refresh-metrics-button";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatNumber } from "@/lib/dashboard/format";
import { getPostListRows } from "@/lib/dashboard/posts-data";
import { filterAndSortPosts, parsePostListFilters } from "@/lib/dashboard/posts-list";
import { getXUsageToday } from "@/lib/services/social/x-usage";

export const metadata: Metadata = {
  title: "Gönderiler — betrix.pro",
  description: "Instagram ve X'teki tüm gönderiler ve metrikleri",
};

// Veritabanından okunan canlı veri — statik önbelleğe alınmaz (bkz. CLAUDE.md 1.5).
export const dynamic = "force-dynamic";

interface PostsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function PostsPage({ searchParams }: PostsPageProps) {
  const filters = parsePostListFilters(await searchParams);
  const [rows, xUsage] = await Promise.all([getPostListRows(), getXUsageToday()]);
  const visible = filterAndSortPosts(rows, filters);

  return (
    <>
      <PageHeader
        title="Gönderiler"
        description="Instagram ve X'teki tüm gönderiler (panelden paylaşılan + içe aktarılan). Metrikler yayından 1 sa, 6 sa, 24 sa, 72 sa, 7 g ve 30 g sonra otomatik çekilir; paylaşım her zaman elle yapılır."
        actions={
          <a href="/dashboard/posts/export" download className={buttonVariants({ variant: "outline" })}>
            <FileDown className="size-3.5" />
            Veriyi indir (CSV)
          </a>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Veri toplama</CardTitle>
          <CardDescription>Geçmiş gönderileri içe aktarın ya da tüm gönderilerin metriklerini hemen çekin. Yalnızca okuma yapılır.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-start justify-between gap-6">
          <ImportPostsForm xRemainingToday={Math.max(0, xUsage.limit - xUsage.posts)} />
          <RefreshMetricsButton label="Tümünü şimdi güncelle" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <CardTitle>Tüm gönderiler</CardTitle>
            <CardDescription>
              {formatNumber(visible.length)} / {formatNumber(rows.length)} gönderi · sütun başlığına tıklayarak sıralayın
            </CardDescription>
          </div>
          <PostListFiltersForm filters={filters} />
        </CardHeader>
        <CardContent>
          <PostListTable rows={visible} filters={filters} />
        </CardContent>
      </Card>
    </>
  );
}
