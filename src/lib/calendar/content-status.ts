import type { ContentStatus } from "@/types/calendar";

interface ContentStatusMeta {
  label: string;
  dotClassName: string;
}

export const CONTENT_STATUS_META: Record<ContentStatus, ContentStatusMeta> = {
  idea: { label: "Fikir", dotClassName: "bg-muted-foreground" },
  pending: { label: "Bekliyor", dotClassName: "bg-amber-400" },
  produced: { label: "Üretildi", dotClassName: "bg-emerald-400" },
};

export const CONTENT_STATUS_ORDER: ContentStatus[] = ["idea", "pending", "produced"];
