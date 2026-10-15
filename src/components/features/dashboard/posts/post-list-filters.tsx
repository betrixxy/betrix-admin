import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { CONTENT_TYPES } from "@/lib/dashboard/content-types";
import type { PostListFilters } from "@/lib/dashboard/posts-list";

/** Platform, tarih aralığı (İstanbul günü) ve içerik türü filtresi — durum URL'dedir (bkz. CLAUDE.md 1.8). */
export function PostListFiltersForm({ filters }: { filters: PostListFilters }) {
  return (
    <form method="get" action="/dashboard/posts" className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="sort" value={filters.sort} />
      <input type="hidden" name="dir" value={filters.dir} />
      <div className="flex flex-col gap-1">
        <Label htmlFor="filter-platform" className="text-xs">Platform</Label>
        <NativeSelect id="filter-platform" name="platform" defaultValue={filters.platform === "X" ? "x" : filters.platform ? "instagram" : ""}>
          <option value="">Tümü</option>
          <option value="instagram">Instagram</option>
          <option value="x">X</option>
        </NativeSelect>
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="filter-from" className="text-xs">Başlangıç</Label>
        <Input id="filter-from" name="from" type="date" defaultValue={filters.from ?? ""} />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="filter-to" className="text-xs">Bitiş</Label>
        <Input id="filter-to" name="to" type="date" defaultValue={filters.to ?? ""} />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="filter-type" className="text-xs">İçerik türü</Label>
        <NativeSelect id="filter-type" name="type" defaultValue={filters.contentType ?? ""}>
          <option value="">Tümü</option>
          <option value="none">Türü yok (içe aktarılan)</option>
          {CONTENT_TYPES.map((type) => (
            <option key={type.id} value={type.id}>
              {type.label}
            </option>
          ))}
        </NativeSelect>
      </div>
      <Button type="submit" variant="secondary">Filtrele</Button>
      <Link href="/dashboard/posts" className={buttonVariants({ variant: "ghost" })}>
        Temizle
      </Link>
    </form>
  );
}
