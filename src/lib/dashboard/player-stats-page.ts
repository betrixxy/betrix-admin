import { resolveSetImages } from "@/lib/dashboard/checkmatch-set";
import { MATCH_DAY_FRAMES } from "@/lib/dashboard/match-day-formats";
import { prepareMatchPhoto } from "@/lib/dashboard/match-photo";
import { COMPETITION_COLORS, resultAccentHex } from "@/lib/dashboard/match-result-theme";
import { buildSpotlightCard, buildTopPlayersCard, teamHexes, type PlayerNames } from "@/lib/dashboard/player-stats-card";
import { renderSpotlightImage, renderTopPlayersImage } from "@/lib/dashboard/player-stats-render";
import { playerCardNames, playerPortraits, spotlightFullName, spotlightPhoto } from "@/lib/dashboard/player-stats-studio";
import { reportJobStep } from "@/lib/jobs/studio-jobs";
import { defaultSpotlightId, topPlayers } from "@/lib/player-stats/picks";
import { PROVISIONAL_NOTE } from "@/lib/player-stats/plan";
import { SPOTLIGHT_MIN_ROWS, SPOTLIGHT_TARGET_ROWS, statRows } from "@/lib/player-stats/rows";
import { spotlightGeometry } from "@/skills/render-engine/templates/player-stats/geometry";
import type { ColumnSide } from "@/skills/render-engine/templates/checkmatch-set/landscape";
import type { MatchDayFormatId } from "@/types/match-day";
import type { PlayerMatchLine, PlayerStatsFacts, PlayerStatsTemplateId, TopPlayerCount } from "@/types/player-match-stats";
import type { Result } from "@/types/result";

/**
 * Oyuncu sayfasının (A ya da B) çizimi — tek başına üretim ve Maç Sonucu carousel'i (03) ortak kullanır.
 * Veri kesinleşmemişse kart ÜRETİLMEZ (sebep + "yeniden dene"). A: seçilen oyuncu (varsayılan Maç Sonucu
 * MVP'si), arşivden formalı fotoğraf → tam kadraj hattı (kalite kapısı, yüz, kırpma, tonlama); fotoğraf yoksa
 * tipografik yedek. B: en iyi 3/5 (≥ 30 dk), vesikalıklar. Her iki sayfada yerleşim kapısı.
 */

type PageError = { code: string; message: string; notSettled?: boolean };
const fail = (code: string, message: string): { ok: false; error: PageError } => ({ ok: false, error: { code, message } });

export interface PlayerPageInput {
  facts: PlayerStatsFacts;
  template: PlayerStatsTemplateId;
  format: MatchDayFormatId;
  /** A: oyuncu (boş → Maç Sonucu MVP'si). */
  playerId?: number | null | undefined;
  /** A: seçilen arşiv fotoğrafı; `"none"` → tipografik; boş → en yeni formalı fotoğraf. */
  photoId?: string | null | undefined;
  /** Carousel'de 01'in fotoğrafı: başka fotoğraf varsa A onu tekrar kullanmaz. */
  avoidPhotoId?: string | null | undefined;
  count?: TopPlayerCount | undefined;
  pageLabel: string | null;
  /** Carousel'de 01 ile aynı sütun tarafı (16:9); tek başına üretimde fotoğrafa göre seçilir. */
  side?: ColumnSide | undefined;
  /** B zemini: carousel'de 01'in nihai görseli. */
  resultImage?: Buffer | null | undefined;
  /** "Şimdi üret (veriler değişebilir)": kesinleşmemiş veriyle çizilir, notun başına uyarı yazılır. */
  allowUnsettled?: boolean | undefined;
}

export interface PlayerPage {
  image: Buffer;
  notes: string[];
  paidCalls: number;
  side: ColumnSide;
  /** A'nın oyuncusu ya da B'nin oyuncuları. */
  lines: PlayerMatchLine[];
  names: PlayerNames;
  photo: { photoId: string; fileUrl: string } | null;
  fact: string | null;
}

export async function renderPlayerPage(input: PlayerPageInput): Promise<Result<PlayerPage, PageError>> {
  const { facts } = input;
  if (!facts.settlement.settled && !input.allowUnsettled) return { ok: false, error: { code: "NOT_SETTLED", message: `Oyuncu verisi henüz kesinleşmedi — ${facts.settlement.reason} Kart üretilmedi; biraz sonra yeniden deneyin.`, notSettled: true } };
  const page = await (input.template === "SPOTLIGHT" ? spotlight(input) : top(input));
  if (page.ok && !facts.settlement.settled) page.data.notes.unshift(PROVISIONAL_NOTE);
  return page;
}

async function spotlight(input: PlayerPageInput): Promise<Result<PlayerPage, PageError>> {
  const { facts } = input;
  const frame = MATCH_DAY_FRAMES[input.format];
  const defaultId = defaultSpotlightId(facts.match);
  const playerId = input.playerId ?? defaultId;
  const line = facts.lines.find((candidate) => candidate.playerId === playerId);
  if (!line) return fail("PLAYER_MISSING", "Seçilen oyuncu bu maçta süre almadı ya da verisi yok.");
  if (line.rating === null) return fail("NO_RATING", "Seçilen oyuncunun sağlayıcı puanı yok — kart üretilmedi.");
  const rowCount = statRows(line).length;
  if (rowCount < SPOTLIGHT_MIN_ROWS) return fail("TOO_FEW_STATS", `Seçilen oyuncu için yalnızca ${rowCount} istatistik geldi (en az ${SPOTLIGHT_MIN_ROWS}) — kart üretilmedi.`);

  reportJobStep("Oyuncu adı ve fotoğrafı");
  const team = line.side === "HOME" ? facts.match.home : facts.match.away;
  const [names, fullName, setImages, photo] = await Promise.all([
    playerCardNames(facts, [line]),
    spotlightFullName(line, team.origin?.people ?? null),
    resolveSetImages(facts.match),
    input.photoId === "none" ? null : spotlightPhoto(line, { photoId: input.photoId, avoidPhotoId: input.avoidPhotoId }),
  ]);
  const images = { homeLogo: setImages.homeLogo, awayLogo: setImages.awayLogo, brandLogo: setImages.brandLogo };
  const card = buildSpotlightCard({ facts, line, images, names, fullName, pageLabel: input.pageLabel, typographic: photo === null });

  const notes: string[] = [];
  if (defaultId !== null && playerId !== defaultId) {
    const mvp = facts.lines.find((candidate) => candidate.playerId === defaultId);
    notes.push(`Oyuncu değiştirildi: maçın oyuncusu önerisi ${mvp?.name ?? "—"}, kartta ${line.name}.`);
  }
  if (rowCount < SPOTLIGHT_TARGET_ROWS) notes.push(`Bu oyuncu için ${rowCount} istatistik geldi (hedef ${SPOTLIGHT_TARGET_ROWS}–8) — eksik satırlar yazılmadı.`);
  if (!card.hero.concat(card.rows).some((row) => row.key === "xg") && line.position === "F") notes.push(facts.sportmonksMatched ? "xG yok: Sportmonks'ta oyuncunun dakikası tutmadı ya da şut verisi yok." : "xG yok: Sportmonks maçı eşleşmedi.");

  let art: Buffer | null = null;
  let shadeStrength = 0;
  let side: ColumnSide = input.side ?? "right";
  let paidCalls = 0;
  if (photo) {
    reportJobStep("Yüz tespiti ve kırpma");
    const prepared = await prepareMatchPhoto({
      image: photo.image,
      frame,
      accentHex: resultAccentHex(facts.match),
      deepHex: COMPETITION_COLORS[facts.match.competition.kind]?.deep,
      geometry: (candidate) => spotlightGeometry(frame, card, candidate).photo,
      sides: input.side ? [input.side] : undefined,
    });
    if (!prepared.ok) return fail(prepared.error.code, prepared.error.message);
    ({ art, shadeStrength, side } = prepared.data);
    paidCalls = prepared.data.quality.paidCalls;
    notes.push(...prepared.data.quality.warnings);
    if (!prepared.data.crop.facesInSafe) notes.push("Oyuncu sayfası: yüzler yazısız bölgeye tam sığmadı.");
  } else {
    notes.push(input.photoId === "none" ? "Fotoğrafsız (tipografik) tasarım seçildi." : "Oyuncunun bu takımın formalı arşiv fotoğrafı yok — tipografik yedek tasarım çizildi.");
  }

  reportJobStep("Oyuncu kartı çiziliyor");
  const rendered = await renderSpotlightImage({ card, frame, art, shadeStrength, side, seedKey: `player-${facts.match.fixtureId}-${line.playerId}` });
  if (!rendered.ok) return rendered;
  return { ok: true, data: { image: rendered.data, notes, paidCalls, side, lines: [line], names, photo: photo ? { photoId: photo.photoId, fileUrl: photo.fileUrl } : null, fact: card.fact } };
}

async function top(input: PlayerPageInput): Promise<Result<PlayerPage, PageError>> {
  const { facts } = input;
  const frame = MATCH_DAY_FRAMES[input.format];
  const count = input.count ?? 3;
  const lines = topPlayers(facts.lines, count);
  if (lines.length < count) return fail("TOO_FEW_PLAYERS", `En az 30 dakika oynamış puanlı ${count} oyuncu yok (${lines.length}) — kart üretilmedi.`);
  reportJobStep("Oyuncu adları ve vesikalıklar");
  const hexes = teamHexes(facts.match);
  const [names, setImages, portraits] = await Promise.all([playerCardNames(facts, lines), resolveSetImages(facts.match), playerPortraits(lines, (line) => hexes[line.side])]);
  const card = buildTopPlayersCard({ facts, lines, images: { homeLogo: setImages.homeLogo, awayLogo: setImages.awayLogo, brandLogo: setImages.brandLogo, portraits }, names, pageLabel: input.pageLabel });
  const noPortrait = lines.filter((line) => !portraits.get(line.playerId)).map((line) => names.get(line.playerId)?.name ?? line.name);
  const notes = noPortrait.length > 0 ? [`Vesikalık yok (takım logosu çizildi): ${noPortrait.join(", ")}.`] : [];
  reportJobStep("En iyiler kartı çiziliyor");
  const rendered = await renderTopPlayersImage({ card, frame, resultImage: input.resultImage ?? null, teamHexes: [hexes.HOME, hexes.AWAY], seedKey: `top-${facts.match.fixtureId}-${count}` });
  if (!rendered.ok) return rendered;
  return { ok: true, data: { image: rendered.data, notes, paidCalls: 0, side: input.side ?? "right", lines, names, photo: null, fact: null } };
}
