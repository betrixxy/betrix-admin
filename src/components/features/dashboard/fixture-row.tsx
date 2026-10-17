import type { CSSProperties, ReactNode } from "react";
import { FIXTURE_ROW_COLUMNS, type FixtureRowData } from "@/lib/dashboard/fixture-row";
import { cn } from "@/lib/utils";
import { KickoffCountdown } from "./kickoff-countdown";

/**
 * Ortak maç satırı — Maç Merkezi ve İçerik Planı aynı sabit sütunlu grid'i kullanır:
 * [saat/skor + lig | ev sahibi (sağa yaslı) | vs | deplasman | durum/sayaç | işlem]. Boş hücre
 * de yer kaplar (sütunlar satırdan satıra kaymaz). Logolar sabit 24px kutuda, uzun adlar tek
 * satırda "…" ile kısalır, tam ad `title`'da. İşlem sütununun genişliğini liste verir
 * (`actionsWidth`) — aynı listedeki tüm satırlar aynı şablonu paylaşır.
 */

const timeFormatter = new Intl.DateTimeFormat("tr-TR", { timeZone: "Europe/Istanbul", hour: "2-digit", minute: "2-digit" });

function KickoffCell({ row }: { row: FixtureRowData }) {
  const { state } = row;
  if (state.kind === "finished") return <span className="truncate text-sm font-semibold tabular-nums text-white" title={state.score}>{state.score}</span>;
  return <span className="text-sm font-medium tabular-nums text-white">{timeFormatter.format(new Date(row.kickoffUtc))}</span>;
}

/** Durum/sayaç: canlıda rozet + dakika, ertelenen/iptalde etiket, 24 saat içindeki maçta geri sayım; yoksa boş. */
function StatusCell({ row }: { row: FixtureRowData }) {
  const { state } = row;
  switch (state.kind) {
    case "live":
      return (
        <span className="flex items-center gap-1.5">
          <span className="rounded bg-red-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-400">Canlı</span>
          {state.minute ? <span className="text-xs tabular-nums text-red-300">{state.minute}</span> : null}
        </span>
      );
    case "inactive":
      return <span className="truncate text-xs text-amber-300" title={state.label}>{state.label}</span>;
    case "upcoming":
      return <KickoffCountdown kickoffUtc={row.kickoffUtc} />;
    case "finished":
      return null;
  }
}

function TeamCell({ name, logoUrl, align }: { name: string; logoUrl: string; align: "start" | "end" }) {
  return (
    <span className={cn("flex min-w-0 items-center gap-2", align === "end" && "flex-row-reverse text-right")}>
      <span className="flex size-6 shrink-0 items-center justify-center">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="" width={24} height={24} className="size-6 object-contain" loading="lazy" />
        ) : null}
      </span>
      <span className="min-w-0 truncate text-sm text-white" title={name}>
        {name}
      </span>
    </span>
  );
}

interface FixtureRowProps {
  row: FixtureRowData;
  /** İşlem sütunu (yıldız, menü, ilerleme…) — liste bağlamına göre. */
  actions: ReactNode;
  /** İşlem sütununun genişliği (CSS), ör. "27rem". Listedeki tüm satırlarda aynı olmalı. */
  actionsWidth: string;
}

export function FixtureRow({ row, actions, actionsWidth }: FixtureRowProps) {
  return (
    <li
      className={cn("grid grid-cols-1 items-center gap-x-4 gap-y-2 px-6 py-3", FIXTURE_ROW_COLUMNS)}
      style={{ "--fixture-row-actions": actionsWidth } as CSSProperties}
    >
      <div className="flex min-w-0 flex-col">
        <KickoffCell row={row} />
        <span className="truncate text-[11px] text-muted-foreground" title={row.leagueName}>
          {row.leagueName}
        </span>
      </div>
      <TeamCell name={row.homeName} logoUrl={row.homeLogo} align="end" />
      <span className="hidden text-center text-xs text-muted-foreground md:block">vs</span>
      <TeamCell name={row.awayName} logoUrl={row.awayLogo} align="start" />
      <div className="flex min-w-0 items-center">
        <StatusCell row={row} />
      </div>
      <div className="flex min-w-0 items-center justify-end gap-3">{actions}</div>
    </li>
  );
}
