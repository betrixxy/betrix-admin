import { nameSimilarity, nameTokens, normalizeName, stripClubAffixes, tokensContained } from "@/lib/media-server/names";
import type {
  CertainMatch,
  FmPerson,
  ManualReview,
  MatchCandidate,
  MatchOutcome,
  MediaApiPlayer,
  PlayerMatchMethod,
} from "@/types/media-server";

/**
 * FM yüzü → API-Football oyuncusu. Kesin eşleşme kuralları (hepsi birden):
 * 1. Doğum tarihi birebir aynı (FM DoB ↔ API birth.date; çelişkili API verisi = tarih yok);
 * 2a. normalize tam ad API'nin kısa ya da resmi adıyla BİREBİR aynı → "NAME_EXACT+DOB", veya
 * 2b. FM adının tüm parçaları API resmi adında var ("Vinícius Júnior" ⊂ "Vinícius José Paixão
 *     de Oliveira Júnior") VE FM kulübü oyuncunun API takımlarından biriyle aynı → "NAME_TOKENS+DOB+CLUB";
 * 3. aynı doğum tarihinde bu kurala uyan TEK API oyuncusu var;
 * 4. o API oyuncusuna başka hiçbir FM yüzü kesin eşleşmemiş (ters tekillik).
 * Benzerlik skoru (fuzzy) yalnızca manuel kontrol adaylarını sıralar, asla kesin karar vermez.
 */

type StrictTier = "EXACT" | "TOKENS";

const SAME_DOB_MIN_SIMILARITY = 0.5;
const MAX_CANDIDATES = 5;

export interface PlayerMatchContext {
  teamNames: Map<number, string>;
  /** Takım kimliği → kulüp doğrulamasında kabul edilen normalize adlar (bkz. buildTeamAliases). */
  teamAliases: Map<number, Set<string>>;
}

function legalName(p: MediaApiPlayer): string {
  return `${p.firstname ?? ""} ${p.lastname ?? ""}`.trim();
}

export function strictNameTier(fmName: string, p: MediaApiPlayer): StrictTier | null {
  const fmNorm = normalizeName(fmName);
  if (fmNorm === "") return null;
  const legal = legalName(p);
  if (normalizeName(p.name) === fmNorm || (legal !== "" && normalizeName(legal) === fmNorm)) return "EXACT";

  const fmTokens = nameTokens(fmName);
  if (fmTokens.length >= 2 && tokensContained(fmTokens, nameTokens(legal))) return "TOKENS";
  // API kısa adı baş harf içermiyorsa ("Gabriel Jesus") ve FM adının içindeyse.
  const shortTokens = nameTokens(p.name);
  if (shortTokens.length >= 2 && shortTokens.every((t) => t.length > 1) && tokensContained(shortTokens, fmTokens)) {
    return "TOKENS";
  }
  return null;
}

function clubConsistent(fm: FmPerson, p: MediaApiPlayer, ctx: PlayerMatchContext): boolean {
  if (!fm.club) return false;
  const keys = [normalizeName(fm.club), stripClubAffixes(fm.club)].filter((k) => k !== "");
  return p.teamIds.some((id) => keys.some((k) => ctx.teamAliases.get(id)?.has(k) ?? false));
}

export function describePlayer(p: MediaApiPlayer, ctx: PlayerMatchContext): string {
  const legal = legalName(p);
  const teams = p.teamIds.map((id) => ctx.teamNames.get(id) ?? `takım ${id}`).join(", ");
  const number = p.number !== null ? ` #${p.number}` : "";
  return `API ${p.id} | ${p.name}${legal && legal !== p.name ? ` (${legal})` : ""} | DoB ${p.birthDate ?? "yok"} | ${teams}${number}`;
}

function describeFm(fm: FmPerson): string {
  return `FM: "${fm.name}" | DoB ${fm.dob ?? "yok"} | Kulüp: ${fm.club ?? "yok"}`;
}

function buildIndexes(players: MediaApiPlayer[]) {
  const byDob = new Map<string, MediaApiPlayer[]>();
  const byToken = new Map<string, Set<MediaApiPlayer>>();
  for (const p of players) {
    if (p.birthDate) byDob.set(p.birthDate, [...(byDob.get(p.birthDate) ?? []), p]);
    for (const token of new Set([...nameTokens(p.name), ...nameTokens(legalName(p))])) {
      const set = byToken.get(token) ?? new Set<MediaApiPlayer>();
      set.add(p);
      byToken.set(token, set);
    }
  }
  return { byDob, byToken };
}

/** FM adının tüm parçalarını içeren API oyuncuları (doğum tarihinden bağımsız). */
function strictNameAnyDob(fm: FmPerson, byToken: Map<string, Set<MediaApiPlayer>>): MediaApiPlayer[] {
  const tokens = nameTokens(fm.name);
  const sets = tokens.map((t) => byToken.get(t) ?? new Set<MediaApiPlayer>()).sort((a, b) => a.size - b.size);
  const [smallest, ...rest] = sets;
  if (!smallest) return [];
  return [...smallest].filter((p) => rest.every((s) => s.has(p)) && strictNameTier(fm.name, p) !== null);
}

export function matchPlayers(
  fmPeople: FmPerson[],
  apiPlayers: MediaApiPlayer[],
  ctx: PlayerMatchContext,
): MatchOutcome<PlayerMatchMethod> {
  const { byDob, byToken } = buildIndexes(apiPlayers);
  const tentative: CertainMatch<PlayerMatchMethod>[] = [];
  const manual: ManualReview[] = [];
  let outOfScope = 0;

  const toCandidate = (fm: FmPerson, p: MediaApiPlayer): MatchCandidate => ({
    apiId: p.id,
    label: describePlayer(p, ctx),
    similarity: Math.max(nameSimilarity(fm.name, p.name), legalName(p) ? nameSimilarity(fm.name, legalName(p)) : 0),
  });

  for (const fm of fmPeople) {
    const sameDob = fm.dob ? (byDob.get(fm.dob) ?? []) : [];
    const strictSame = sameDob
      .map((p) => ({ p, tier: strictNameTier(fm.name, p) }))
      .filter((x): x is { p: MediaApiPlayer; tier: StrictTier } => x.tier !== null);
    const single = strictSame.length === 1 ? strictSame[0] : undefined;

    if (single && single.tier === "EXACT") {
      tentative.push({ fmUid: fm.uid, fmName: fm.name, apiId: single.p.id, apiName: single.p.name, method: "NAME_EXACT+DOB" });
      continue;
    }
    if (single && clubConsistent(fm, single.p, ctx)) {
      tentative.push({ fmUid: fm.uid, fmName: fm.name, apiId: single.p.id, apiName: single.p.name, method: "NAME_TOKENS+DOB+CLUB" });
      continue;
    }
    if (single) {
      manual.push({
        fmUid: fm.uid,
        fmLabel: describeFm(fm),
        reason: "Doğum tarihi aynı, isim yalnızca kısmen uyuşuyor ve kulüp doğrulanamadı.",
        candidates: [toCandidate(fm, single.p)],
      });
      continue;
    }
    if (strictSame.length > 1) {
      manual.push({
        fmUid: fm.uid,
        fmLabel: describeFm(fm),
        reason: `Aynı isim + aynı doğum tarihiyle ${strictSame.length} API oyuncusu var — hangisi olduğu belirsiz.`,
        candidates: strictSame.map((x) => toCandidate(fm, x.p)),
      });
      continue;
    }

    const similarSameDob = sameDob
      .map((p) => toCandidate(fm, p))
      .filter((c) => c.similarity >= SAME_DOB_MIN_SIMILARITY);
    const nameOnly = strictNameAnyDob(fm, byToken)
      .filter((p) => !fm.dob || clubConsistent(fm, p, ctx))
      .map((p) => toCandidate(fm, p));
    const candidates = [...new Map([...similarSameDob, ...nameOnly].map((c) => [c.apiId, c])).values()]
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, MAX_CANDIDATES);

    if (candidates.length === 0) {
      outOfScope += 1;
      continue;
    }
    const reason = !fm.dob
      ? "FM kaydında geçerli doğum tarihi yok — isim tek başına kesinlik sağlamaz."
      : similarSameDob.length > 0
        ? "Doğum tarihi aynı ama isim %100 uyuşmuyor."
        : "İsim ve kulüp uyuşuyor ama doğum tarihi farklı.";
    manual.push({ fmUid: fm.uid, fmLabel: describeFm(fm), reason, candidates });
  }

  return finalizeUnique(tentative, manual, outOfScope, fmPeople, apiPlayers, ctx);
}

/** Ters tekillik: aynı API oyuncusuna birden fazla FM yüzü kesinleştiyse hepsi manuele düşer. */
function finalizeUnique(
  tentative: CertainMatch<PlayerMatchMethod>[],
  manual: ManualReview[],
  outOfScope: number,
  fmPeople: FmPerson[],
  apiPlayers: MediaApiPlayer[],
  ctx: PlayerMatchContext,
): MatchOutcome<PlayerMatchMethod> {
  const claims = new Map<number, number>();
  for (const m of tentative) claims.set(m.apiId, (claims.get(m.apiId) ?? 0) + 1);
  const peopleByUid = new Map(fmPeople.map((p) => [p.uid, p]));
  const playersById = new Map(apiPlayers.map((p) => [p.id, p]));

  const certain: CertainMatch<PlayerMatchMethod>[] = [];
  for (const m of tentative) {
    if (claims.get(m.apiId) === 1) {
      certain.push(m);
      continue;
    }
    const fm = peopleByUid.get(m.fmUid);
    const p = playersById.get(m.apiId);
    manual.push({
      fmUid: m.fmUid,
      fmLabel: fm ? describeFm(fm) : `FM: "${m.fmName}"`,
      reason: `Bu API oyuncusu ${claims.get(m.apiId)} farklı FM yüzüyle eşleşti — hangisinin doğru olduğu belirsiz.`,
      candidates: [{ apiId: m.apiId, label: p ? describePlayer(p, ctx) : `API ${m.apiId} | ${m.apiName}`, similarity: 1 }],
    });
  }
  return { certain, manual, outOfScope };
}
