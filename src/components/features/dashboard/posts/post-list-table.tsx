import Link from "next/link";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { ArrowDown, ArrowUp } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getContentType } from "@/lib/dashboard/content-types";
import { formatCompactNumber, formatPercent } from "@/lib/dashboard/format";
import { postListQuery, type PostListFilters, type PostListRow, type PostSort } from "@/lib/dashboard/posts-list";
import { PLATFORM_DOT_CLASS, PLATFORM_LABELS } from "@/lib/dashboard/social-meta";
import { cn } from "@/lib/utils";
import { RenderThumbnail } from "../render-thumbnail";

const COLUMNS: { sort: PostSort; label: string; title?: string; value: (row: PostListRow) => string }[] = [
  { sort: "likes", label: "Beğeni", value: (row) => formatCompactNumber(row.likes) },
  { sort: "comments", label: "Yorum", value: (row) => formatCompactNumber(row.comments) },
  { sort: "shares", label: "Paylaşım", value: (row) => formatCompactNumber(row.shares) },
  { sort: "saves", label: "Kaydetme", value: (row) => formatCompactNumber(row.saves) },
  { sort: "reach", label: "Erişim", title: "Gönderiyi gören tekil hesap (X vermez)", value: (row) => (row.reach ? formatCompactNumber(row.reach) : "—") },
  { sort: "views", label: "Gösterim", title: "Görüntülenme / gösterim", value: (row) => formatCompactNumber(row.views) },
  { sort: "engagement", label: "Etk. oranı", title: "(beğeni + yorum + paylaşım + kaydetme) / erişim (yoksa gösterim)", value: (row) => (row.engagementRate === null ? "—" : formatPercent(row.engagementRate)) },
  { sort: "clicks", label: "Link tık.", title: "Kısa link tıklaması (bot hariç)", value: (row) => formatCompactNumber(row.linkClicks) },
  { sort: "visitors", label: "Site ziyaretçi", title: "checkmatch.net'e gelen tekil ziyaretçi", value: (row) => formatCompactNumber(row.siteVisitors) },
];

function SortHeader({ filters, sort, label, title }: { filters: PostListFilters; sort: PostSort; label: string; title?: string }) {
  const active = filters.sort === sort;
  const dir = active && filters.dir === "desc" ? "asc" : "desc";
  const Icon = filters.dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <Link href={`/dashboard/posts${postListQuery(filters, { sort, dir })}`} title={title} className={cn("inline-flex items-center gap-1 hover:text-white", active && "text-white")}>
      {label}
      {active ? <Icon className="size-3" /> : null}
    </Link>
  );
}

export function PostListTable({ rows, filters }: { rows: PostListRow[]; filters: PostListFilters }) {
  if (rows.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Bu filtrede gönderi yok. {"Geçmiş gönderileri içe aktarın ya da Yayın Merkezi'nden paylaşın."}</p>;
  }
  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className="w-14" />
          <TableHead>
            <SortHeader filters={filters} sort="date" label="Tarih" />
          </TableHead>
          <TableHead>İçerik türü</TableHead>
          {COLUMNS.map((column) => (
            <TableHead key={column.sort} className="text-right">
              <SortHeader filters={filters} sort={column.sort} label={column.label} {...(column.title ? { title: column.title } : {})} />
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell>
              <Link href={`/dashboard/posts/${row.id}`} className="flex size-11 items-center justify-center overflow-hidden rounded-md bg-black/30">
                <RenderThumbnail src={row.thumbnailUrl} alt="Gönderi görseli" />
              </Link>
            </TableCell>
            <TableCell className="whitespace-nowrap">
              <Link href={`/dashboard/posts/${row.id}`} className="flex flex-col hover:underline">
                <span className="flex items-center gap-1.5 text-white">
                  <span className={cn("size-2 rounded-full", PLATFORM_DOT_CLASS[row.platform])} />
                  {PLATFORM_LABELS[row.platform]}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {row.publishedAt ? format(new Date(row.publishedAt), "d MMM yyyy, HH:mm", { locale: tr }) : "—"}
                  {row.source === "IMPORTED" ? " · içe aktarıldı" : ""}
                </span>
              </Link>
            </TableCell>
            <TableCell className="text-xs text-muted-foreground">{row.contentType ? (getContentType(row.contentType)?.label ?? row.contentType) : "—"}</TableCell>
            {COLUMNS.map((column) => (
              <TableCell key={column.sort} className={cn("text-right tabular-nums", filters.sort === column.sort && "font-semibold text-white")}>
                {column.value(row)}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
