import { z } from "zod";
import { getContentType } from "@/lib/dashboard/content-types";
import { seasonText } from "@/lib/draw/rounds";

/**
 * Onay kuyruğu satırının okunur adı (saf): tür adı katalogdan (`getContentType(id).label` — katalog kimliği
 * değişse de çalışır) + başlık. Ham kayıt anahtarı ("draw:2:2026:LEAGUE", "manual:player-h2h") GÖRÜNMEZ:
 * maç etiketi → Kura'nın turnuva/tur/sezonu → kaydın kendi başlığı (`title` · `subtitle`) → lig adı → genel ad.
 */

export interface DraftQueueLabel {
  type: string;
  title: string;
}

const drawSchema = z.object({
  states: z.array(z.object({ competition: z.object({ name: z.string() }), season: z.number(), roundLabel: z.string() })).min(1),
});
const titledSchema = z.object({ title: z.string().min(1), subtitle: z.string().optional() });
const leagueSchema = z.object({ leagueName: z.string().min(1), kindLabel: z.string().optional() });

function drawTitle(renderOptions: unknown): string | null {
  const parsed = drawSchema.safeParse(renderOptions);
  if (!parsed.success) return null;
  const [first, ...rest] = parsed.data.states;
  if (!first) return null;
  // Türk temsilcileri (birden çok turnuva) tek satırda: "Avrupa kupaları · 2026/27".
  return rest.length > 0 ? `Avrupa kupaları · ${seasonText(first.season)}` : `${first.competition.name} · ${first.roundLabel} · ${seasonText(first.season)}`;
}

export function draftQueueLabel(row: { contentType: string | null; fixtureId: string; renderOptions: unknown }, fixtureLabels: Record<string, string>): DraftQueueLabel {
  const type = row.contentType ? (getContentType(row.contentType)?.label ?? "İçerik") : "AI İçerik Stüdyosu";
  const titled = titledSchema.safeParse(row.renderOptions);
  const league = leagueSchema.safeParse(row.renderOptions);
  const title =
    (row.contentType === "DRAWS_AND_PAIRINGS" ? drawTitle(row.renderOptions) : null) ??
    fixtureLabels[row.fixtureId] ??
    (titled.success ? [titled.data.title, titled.data.subtitle].filter(Boolean).join(" · ") : null) ??
    (league.success ? [league.data.leagueName, league.data.kindLabel].filter(Boolean).join(" · ") : null) ??
    (row.fixtureId.includes(":") ? "Maçtan bağımsız" : "Maç bilgisi alınamadı");
  return { type, title };
}
