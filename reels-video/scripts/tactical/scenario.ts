import type { Frozen } from "../reel/freeze";
import type { VoiceProfile } from "../reel/voice";
import type { AssetCheck } from "./assets";
import { kickoffLabel } from "./build";
import { screenWordCount, tacticalCaption, type PlanItem, type PlanSource } from "./plan";
import { buildTimeline, estimated, FPS, MAX_HOOK_SECONDS, MAX_SECONDS } from "./timeline";

/**
 * Onaya sunulan senaryo (`senaryo-tactical.txt`). `SES:` satırları render öncesi kurulan metinle birebir karşılaştırılır
 * (`full.ts`); onay = `npm run reel -- --match <id> --onay`. Süreler ölçülmüş konuşma hızıyla tahmindir.
 */

/** 11-07 ölçümü (cümle içi sessizlik kırpıldıktan sonra); profilin örnek hızından daha gerçekçi. */
export const MEASURED_WORDS_PER_SECOND = 2.64;

const LABELS: Record<string, string> = { hook: "GİRİŞ + KANCA", outcome: "KAZANMA İHTİMALİ", goals: "KAÇ GOL OLUR?", both: "İKİ TAKIM DA GOL ATAR MI? + İLK GOL", why: "NEDEN?", duel: "YILDIZLARIN DÜELLOSU", close: "KAPANIŞ" };

function screen(item: PlanItem): string {
  const v = item.values;
  switch (item.kind) {
    case "hook": return `"${String(v.hookLine1).toLocaleUpperCase("tr-TR")}" / "${String(v.hookLine2).toLocaleUpperCase("tr-TR")}"${v.hookAccent ? ` (yeşil: ${String(v.hookAccent).toLocaleUpperCase("tr-TR")})` : ""} · sayaç "ANALİZ MODELİ · 100.000 MAÇ SİMÜLASYONU"`;
    case "outcome": return `%${v.home} · BERABERLİK %${v.draw} · %${v.away} · madde: ${v.because}`;
    case "goals": return `%${v.over} ${v.overLabel} / %${v.under} ${v.underLabel}${v.surprise === "goals" ? " · İŞTE SÜRPRİZ (3+ gol çubuğu)" : ""}`;
    case "both": return `%${v.both} ${v.bothLabel} · ilk gol %${v.firstHome} / %${v.firstAway} / gol yok %${v.firstNone}${v.surprise === "first" ? ` · İŞTE SÜRPRİZ ("ama" anında, ilk gol paneli)` : v.surprise === "both" ? " · İŞTE SÜRPRİZ (iki takım da gol paneli)" : ""}`;
    case "why": return `${v.homeRank}. ${v.homePoints} puan · ${v.awayRank}. ${v.awayPoints} puan · ${v.homeRecord} · ${v.awayRecord}`;
    case "duel": return `${v.homeName} – ${v.awayName} (${v.scope}) · gol ${v.goalsHome}–${v.goalsAway} · asist ${v.assistsHome}–${v.assistsAway} · isabetli şut ${v.shotsHome}–${v.shotsAway} · G+A/90 ${v.per90Home}–${v.per90Away}`;
    case "close": return `kontrol listesi: ${v.c1} · ${v.c2} · ${v.c3} · ${v.c4} · kilitli satırlar "${v.more}" · logo ✓`;
    default: return "";
  }
}

export function scenarioTacticalText(input: { frozen: Frozen; source: PlanSource; items: PlanItem[]; profile: VoiceProfile; assets: AssetCheck; fresh: string[]; estimatedCredits: number }): string {
  const { frozen, source, items, profile, assets } = input;
  const extras = frozen.extras as unknown as { league_name: string; round: string; venue: string | null; teams: Record<"home" | "away", { name: string }> };
  const timeline = buildTimeline(items.map((item) => estimated(item, MEASURED_WORDS_PER_SECOND)));
  const total = timeline.durationInFrames / FPS;
  const hook = (timeline.beats[0]?.duration ?? 0) / FPS;
  const words = items.reduce((sum, item) => sum + screenWordCount(item.sentence), 0);
  const photo = (side: "home" | "away") => { const choice = assets.duel[side]; return choice ? `${choice.person}: ${choice.file.split(/[\\/]/u).slice(-2).join("/")} (${choice.source}, puan ${choice.score})` : "yok"; };
  const lines = [
    `${extras.teams.home.name} – ${extras.teams.away.name} · CANLI TAKTİK TAHTASI (onay bekliyor)`,
    `${extras.league_name} · ${extras.round} · ${kickoffLabel(frozen.detail.match.kickoff_utc)} · ${extras.venue ?? "stadyum bilinmiyor"}`,
    `Kaynak: snapshot.json (dondurma ${frozen.fetched_at}). Skor: hiçbir yerde yok (score_scene_allowed = ${frozen.detail.score_scene_allowed}).`,
    `Profil: ${profile.id}`,
    `Ses: ${profile.label} (${profile.voiceName}) · ${profile.modelId} · hız ${profile.settings.speed.toLocaleString("tr-TR")} · etiket: ${profile.tags ? "[excited] yalnız kancada" : "yok"} · yeni üretim mp3_44100_192`,
    `Seslendirme: ${words} sözcük (rakam öbeği tek) · tahmini ${total.toFixed(1)} sn (sınır ${MAX_SECONDS}) · kanca ~${hook.toFixed(1)} sn (sınır ${MAX_HOOK_SECONDS}) · ölçülen hız ${MEASURED_WORDS_PER_SECOND.toLocaleString("tr-TR")} sözcük/sn`,
    `Yeni ses: ${input.fresh.length ? input.fresh.join(", ") : "yok (önbellekten)"} · tahmini ${input.estimatedCredits} kredi`,
    `Fotoğraflar: ev ${photo("home")} · deplasman ${photo("away")} · stadyum ${assets.venue ? assets.venue.split(/[\\/]/u).slice(-2).join("/") : "yok"}`,
    ...(assets.notes.length ? [`Notlar: ${assets.notes.join(" | ")}`] : []),
    "",
  ];
  items.forEach((item, index) => {
    lines.push(`--- ${index + 1}. ${LABELS[item.kind] ?? item.kind}${item.tag ? ` · etiket ${item.tag}` : ""} | ${screenWordCount(item.sentence)} sözcük`);
    lines.push(`SES: ${item.sentence}`);
    lines.push(`EKRAN: ${screen(item)}`);
    lines.push("");
  });
  lines.push("--- AÇIKLAMA (aciklama.txt)", tacticalCaption(source, items), "");
  lines.push("--- ONAY", "Bu metni onaylıyorsan: npm run reel -- --match " + frozen.detail.match.id + " --onay (ses profili bu dosyadan okunur: " + profile.id + ")");
  return `${lines.join("\n")}\n`;
}
