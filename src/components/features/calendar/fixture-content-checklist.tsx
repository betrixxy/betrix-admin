import Link from "next/link";
import { ArrowRight, Eye } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { buildStudioHref, CONTENT_PHASE_LABELS, CONTENT_TYPES_BY_PHASE } from "@/lib/dashboard/content-types";
import { cn } from "@/lib/utils";
import type { FixtureContentItem, FixtureProduction } from "@/types/calendar";
import type { ContentTypeDef } from "@/types/content-type";

/**
 * Maç kontrol merkezi: katalogdaki her içerik türü için tek satır — ad, durum, aksiyon.
 * Üretilmişse taslak/inceleme ekranına, üretilmemiş ve stüdyosu hazırsa maç bilgileri dolu
 * stüdyoya gider; stüdyosu olmayan türler "Yakında" olarak pasif durur.
 */

const STATUS_META = {
  approved: { label: "Üretildi", className: "bg-emerald-500/15 text-emerald-300" },
  draft: { label: "Onay bekliyor", className: "bg-amber-500/15 text-amber-300" },
  missing: { label: "Bekliyor", className: "bg-white/[0.06] text-muted-foreground" },
} as const;

const ACTION_CLASS = cn(buttonVariants({ size: "xs", variant: "outline" }), "w-[6.75rem] justify-center");

function RowAction({ type, item, fixtureId }: { type: ContentTypeDef; item: FixtureContentItem | undefined; fixtureId: string }) {
  if (item) {
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

function ContentRow({ type, item, fixtureId }: { type: ContentTypeDef; item: FixtureContentItem | undefined; fixtureId: string }) {
  const status = STATUS_META[item?.status ?? "missing"];
  return (
    <li className="flex items-center gap-2 py-2">
      <span className={cn("min-w-0 flex-1 truncate text-[13px]", type.status === "active" || item ? "text-foreground" : "text-muted-foreground")} title={type.description}>
        {type.label}
      </span>
      <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium", status.className)}>{status.label}</span>
      <RowAction type={type} item={item} fixtureId={fixtureId} />
    </li>
  );
}

export function FixtureContentChecklist({ fixtureId, production }: { fixtureId: string; production: FixtureProduction }) {
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
                <ContentRow key={type.id} type={type} item={production[type.id]} fixtureId={fixtureId} />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
