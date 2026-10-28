import type { Metadata } from "next";
import Link from "next/link";
import { DrawStudio } from "@/components/features/dashboard/draw/draw-studio";
import { DraftStatusBadge } from "@/components/features/dashboard/draft-status-badge";
import { PageHeader } from "@/components/features/dashboard/page-header";
import { compareDraws } from "@/lib/dashboard/draw-engine";
import { drawEntryFromFixture } from "@/lib/dashboard/draw-fixture";
import { getDrawRecord, listDrawRecords } from "@/lib/dashboard/draw-records";
import { DEFAULT_DRAW_COMPETITION_ID, drawCompetition, seasonText } from "@/lib/draw/rounds";
import type { AiContentStatus } from "@/types/ai-content";

export const metadata: Metadata = {
  title: "Kura Sonucu — betrix.pro",
  description: "Kura sırasında hızlı eşleşme girişi, anlık önizleme; kura sonrası API karşılaştırması",
};

// Kayıtlı kuralar ve karşılaştırma canlı okunur (bkz. CLAUDE.md 1.5).
export const dynamic = "force-dynamic";

/** Avrupa sezonu Temmuz'da başlar: Ekim 2026 → 2026, Mart 2027 → 2026. */
function currentSeason(now = new Date()): number {
  return now.getUTCMonth() >= 6 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
}

interface DrawPageProps {
  /**
   * `?draftId=` — kayıtlı kurayı kaldığı yerden açar ve API ile karşılaştırır. `?fixtureId=` — Maç Merkezi'nden:
   * maçın turnuvası (Avrupa kupası) ve sezonu seçili açılır; kayıtlı kura açılıyorsa yok sayılır.
   */
  searchParams: Promise<{ draftId?: string | string[]; fixtureId?: string | string[] }>;
}

function fixtureNote(entry: Awaited<ReturnType<typeof drawEntryFromFixture>> | null): { text: string; warn: boolean } | null {
  if (!entry) return null;
  if (!entry.ok) return { text: `Maçın turnuvası alınamadı (${entry.error.message}) — varsayılan turnuva açıldı.`, warn: true };
  const { setup, leagueName } = entry.data;
  if (!setup) return { text: `Bu maçın turnuvası (${leagueName}) kura stüdyosunda yok — kura yalnızca Avrupa kupaları için; varsayılan turnuva açıldı.`, warn: true };
  return { text: `Maçın turnuvası seçili: ${drawCompetition(setup.competitionId)?.name ?? leagueName} · ${seasonText(setup.season)}.`, warn: false };
}

export default async function DrawPage({ searchParams }: DrawPageProps) {
  const params = await searchParams;
  const draftId = typeof params.draftId === "string" ? params.draftId : null;
  const fixtureId = !draftId && typeof params.fixtureId === "string" ? params.fixtureId : null;
  const [record, records, fixtureEntry] = await Promise.all([draftId ? getDrawRecord(draftId) : null, listDrawRecords(), fixtureId ? drawEntryFromFixture(fixtureId) : null]);
  const setup = fixtureEntry?.ok ? fixtureEntry.data.setup : null;
  const note = fixtureNote(fixtureEntry);
  const comparison = record ? await compareDraws(record.states, record.roundIds) : null;
  const initial = record
    ? { sessions: record.states.map((state, index) => ({ state, roundId: record.roundIds[index] ?? "" })), variant: record.variant, format: record.format, focusTeamId: record.focusTeamId, photoId: record.photoId }
    : null;

  return (
    <>
      <PageHeader
        title="Kura Sonucu"
        description="Kura öncesi turnuva, tur ve katılımcıları hazırlayın; kura sırasında eşleşmeleri klavyeyle girin (önizleme her girişte güncellenir). Kayıt taslak doğar, yayın manuel. Kura sonrası girilenler API fikstürüyle karşılaştırılır — otomatik düzeltme yok."
      />
      {draftId && !record ? <p className="mb-4 text-sm text-amber-300">Kayıtlı kura bulunamadı — yeni kura açıldı.</p> : null}
      {note ? <p className={note.warn ? "mb-4 text-sm text-amber-300" : "mb-4 text-sm text-emerald-400"}>{note.text}</p> : null}
      <DrawStudio
        key={draftId ?? fixtureId ?? "new"}
        initial={initial}
        initialComparison={comparison?.ok ? comparison.data : null}
        defaultCompetitionId={setup?.competitionId ?? DEFAULT_DRAW_COMPETITION_ID}
        defaultSeason={setup?.season ?? currentSeason()}
      />
      {records.length ? (
        <section className="mt-8 flex flex-col gap-2">
          <h2 className="text-sm font-medium">Kayıtlı kura kartları</h2>
          <ul className="flex flex-col divide-y divide-border/60 rounded-lg border border-border/60 text-sm">
            {records.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center gap-3 px-3 py-2">
                <DraftStatusBadge status={item.status as AiContentStatus} />
                <span className="min-w-0 flex-1 truncate">
                  {item.title} <span className="text-xs text-muted-foreground">· {item.subtitle}</span>
                </span>
                <Link href={`/dashboard/studio/draw?draftId=${item.id}`} className="text-xs text-emerald-400 hover:underline">
                  Stüdyoda aç · karşılaştır
                </Link>
                <Link href={`/dashboard/drafts/${item.id}`} className="text-xs text-muted-foreground hover:underline">
                  İncele
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
