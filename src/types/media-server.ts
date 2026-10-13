/**
 * Merkezi medya havuzu (FM26 logo + facepack → API-Football kimlikleri) kanonik tipleri.
 * Bkz. `scripts/build-media-server.ts` ve `lib/media-server/`.
 */

/** API-Football'daki bir takım — kapsamdaki liglerden toplanır. */
export interface MediaApiTeam {
  id: number;
  name: string;
  /** API-Football ülke adı (ör. "England", "Czech-Republic"). */
  country: string | null;
  leagueIds: number[];
}

/** API-Football'daki bir oyuncu — takım kadroları ve sezon oyuncu listelerinin birleşimi. */
export interface MediaApiPlayer {
  id: number;
  /** Kısa görünen ad (ör. "M. Salah"). */
  name: string;
  firstname: string | null;
  lastname: string | null;
  /**
   * YYYY-MM-DD. Kaynaklar arasında çelişen doğum tarihi varsa `null` yapılır — çelişkili veriyle
   * kesin eşleşme kurulmaz.
   */
  birthDate: string | null;
  teamIds: number[];
  /** Güncel kadrodaki forma numarası (varsa). */
  number: number | null;
}

/** FM dışa aktarımındaki bir kişi (oyuncu). `uid` = FM Unique ID = `face_<uid>.png`. */
export interface FmPerson {
  uid: string;
  name: string;
  /** YYYY-MM-DD; dışa aktarımda yoksa veya çözümlenemezse `null`. */
  dob: string | null;
  club: string | null;
}

/** FM dışa aktarımındaki bir kulüp. `uid` = FM Unique ID = `club_<uid>.png`. */
export interface FmClub {
  uid: string;
  name: string;
  shortName: string | null;
  nation: string | null;
}

export type DateOrder = "DMY" | "MDY" | "YMD";

/** Kesin eşleşmenin hangi kurala dayandığı — manifest'e yazılır. */
export type PlayerMatchMethod =
  /** Normalize tam ad birebir aynı + doğum tarihi aynı. */
  | "NAME_EXACT+DOB"
  /** FM adının tüm parçaları API resmi adında var + doğum tarihi aynı + kulüp doğrulandı. */
  | "NAME_TOKENS+DOB+CLUB";

export type TeamMatchMethod =
  /** Normalize ad (veya FM kısa adı) birebir aynı + ülke aynı. */
  | "NAME_EXACT+COUNTRY"
  /** "FC", "AFC", "SK" gibi kulüp ekleri atıldıktan sonra ad aynı + ülke aynı. */
  | "NAME_AFFIX_STRIPPED+COUNTRY";

export interface MatchCandidate {
  apiId: number;
  /** Okunabilir aday özeti (log.txt'ye yazılır). */
  label: string;
  similarity: number;
}

export interface CertainMatch<M extends string> {
  fmUid: string;
  fmName: string;
  apiId: number;
  apiName: string;
  method: M;
}

export interface ManualReview {
  fmUid: string;
  /** FM tarafının okunabilir özeti. */
  fmLabel: string;
  reason: string;
  candidates: MatchCandidate[];
}

export interface MatchOutcome<M extends string> {
  certain: CertainMatch<M>[];
  manual: ManualReview[];
  /** Hiçbir API adayına benzemeyen (kapsam dışı) FM kayıt sayısı — kopyalanmaz. */
  outOfScope: number;
}
