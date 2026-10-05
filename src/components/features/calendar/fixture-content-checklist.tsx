"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, CalendarClock, Eye } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { ContentScheduleEditor } from "@/components/features/calendar/content-schedule-editor";
import { formatPublishAt } from "@/lib/calendar/format";
import { buildStudioHref, CONTENT_PHASE_LABELS, CONTENT_TYPES_BY_PHASE } from "@/lib/dashboard/content-types";
import { cn } from "@/lib/utils";
import type { FixtureContentItem, FixtureProduction } from "@/types/calendar";
import type { ContentTypeDef } from "@/types/content-type";

/**
 * Maç kontrol merkezi: katalogdaki her içerik türü için tek satır — ad, durum, planla, aksiyon.
 * Üretilmişse taslak/inceleme ekranına, üretilmemiş ve stüdyosu hazırsa maç bilgileri dolu
 * stüdyoya gider; stüdyosu olmayan türler "Yakında" olarak pasif durur. Takvim ikonu satırın
 * altında yayın zamanı düzenleyicisini açar (bkz. content-schedule-editor.tsx).
 */

const STATUS_META = {
  approved: { label: "Üretildi", className: "bg-emerald-500/15 text-emerald-300" },
  draft: { label: "Onay bekliyor", className: "bg-amber-500/15 text-amber-300" },
  missing: { label: "Bekliyor", className: "bg-white/[0.06] text-muted-foreground" },
} as const;

const PLANNED_CLASS = "bg-sky-500/15 text-sky-300";

const ACTION_CLASS = cn(buttonVariants({ size: "xs", variant: "outline" }), "w-[6.75rem] justify-center");

function RowAction({ type, item, fixtureId }: { type: ContentTypeDef; item: FixtureContentItem | undefined; fixtureId: string }) {
  if (item && item.status !== "planned") {
    return (
      <Link href={`/dashboard/drafts/${item.draftId}`} className={ACTION_CLASS}>
        <Eye />
        {item.status === "approved" ? "Görüntüle" : "İncele"}
      </Link>
    );
  }
  if (type.status === "active") {
    return (
      <Link href={buildStudioHref(type, fixtureId)} className={cn(buttonVariants({ size: "xs" }), "w-[6.75rem] justify-center")}>
        Stüdyoya Git
        <ArrowRight />
      </Link>
    );
  }
  return (
    <button type="button" disabled className={ACTION_CLASS} title="Bu içerik türünün stüdyosu henüz hazır değil.">
      Yakında
    </button>
  );
}

/** Üretilmemiş içerikte plan durumu yerine geçer; üretilmişte üretim durumu gösterilir. */
function StatusPill({ item }: { item: FixtureContentItem | undefined }) {
  const planned = item?.status === "planned";
  const meta = planned ? null : STATUS_META[item?.status ?? "missing"];
  return (
    <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium tabular-nums", meta?.className ?? PLANNED_CLASS)}>
      {planned ? `Planlandı: ${formatPublishAt(item.publishAt)}` : meta?.label}
    </span>
  );
}

interface ContentRowProps {
  type: ContentTypeDef;
  item: FixtureContentItem | undefined;
  fixtureId: string;
  kickoffUtc: string;
}

function ContentRow({ type, item, fixtureId, kickoffUtc }: ContentRowProps) {
  const [editing, setEditing] = useState(false);
  const publishAt = item?.publishAt ?? null;
  const produced = item !== undefined && item.status !== "planned";

  return (
    <li className="py-2">
      <div className="flex items-center gap-2">
        <span className="flex min-w-0 flex-1 flex-col">
          <span className={cn("truncate text-[13px]", type.status === "active" || item ? "text-foreground" : "text-muted-foreground")} title={type.description}>
            {type.label}
          </span>
          {produced && publishAt && <span className="text-[11px] tabular-nums text-sky-300/80">Yayın: {formatPublishAt(publishAt)}</span>}
        </span>
        <StatusPill item={item} />
        <button
          type="button"
          onClick={() => setEditing((open) => !open)}
          aria-expanded={editing}
          aria-label={publishAt ? `Yayın zamanını değiştir (${formatPublishAt(publishAt)})` : "Yayın zamanı planla"}
          title={publishAt ? `Planlandı: ${formatPublishAt(publishAt)}` : "Planla"}
          className={cn(
            buttonVariants({ size: "icon-xs", variant: "ghost" }),
            publishAt ? "text-sky-300 hover:text-sky-200" : "text-muted-foreground",
            editing && "bg-white/[0.06]",
          )}
        >
          <CalendarClock />
        </button>
        <RowAction type={type} item={item} fixtureId={fixtureId} />
      </div>
      {editing && (
        <ContentScheduleEditor fixtureId={fixtureId} kickoffUtc={kickoffUtc} type={type} publishAt={publishAt} onClose={() => setEditing(false)} />
      )}
    </li>
  );
}

interface FixtureContentChecklistProps {
  fixtureId: string;
  kickoffUtc: string;
  production: FixtureProduction;
}

export function FixtureContentChecklist({ fixtureId, kickoffUtc, production }: FixtureContentChecklistProps) {
  return (
    <div className="flex flex-col gap-5">
      {CONTENT_TYPES_BY_PHASE.map(({ phase, types }) => {
        const done = types.filter((type) => production[type.id]?.status === "approved").length;
        return (
          <section key={phase} className="flex flex-col">
            <h3 className="flex items-center justify-between text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {CONTENT_PHASE_LABELS[phase]}
              <span className="tabular-nums normal-case tracking-normal">
                {done}/{types.length}
              </span>
            </h3>
            <ul className="mt-1 divide-y divide-border/60">
              {types.map((type) => (
                <ContentRow key={type.id} type={type} item={production[type.id]} fixtureId={fixtureId} kickoffUtc={kickoffUtc} />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
