import { z } from "zod";
import { contentLanguageGate } from "@/lib/prediction/content-language";
import type { HttpFailure } from "@/lib/services/shared/http";
import type { Result } from "@/types/result";

/**
 * Reels okuma servisi sözleşmesi v1 — Mac'teki `~/reels-service/app/schemas.py` ile birebir. Bilinmeyen alan
 * hatadır (`strictObject`). Gelen her metin `contentLanguageGate`'ten geçer: bahis dili taşıyan yanıt reddedilir.
 */

export const REELS_CONTRACT_VERSION = "1.0";

const utc = z.iso.datetime({ offset: true });
const probability = z.number().min(0).max(1);

const league = z.strictObject({ id: z.number().int(), name: z.string(), round: z.string().nullable() });
const team = z.strictObject({ id: z.number().int(), name: z.string(), logo_url: z.string().nullable() });

export const reelsHealthSchema = z.strictObject({ ok: z.boolean() });

export const reelsMatchListItemSchema = z.strictObject({
  match_id: z.number().int(),
  kickoff_utc: utc,
  league,
  home: team,
  away: team,
  analysis: z.strictObject({ available: z.boolean(), computed_at: utc.nullable() }),
});

const xgLeader = z.strictObject({
  name: z.string(),
  season_goals: z.number().int().nullable(),
  season_xg: z.number().nullable(),
  season_games: z.number().int().nullable(),
  season_year: z.number().int(),
});

const scorer = z.strictObject({
  rank: z.number().int(),
  name: z.string(),
  side: z.enum(["home", "away"]),
  season_goals: z.number().int().nullable(),
  season_xg: z.number().nullable(),
  season_games: z.number().int().nullable(),
  in_recent_squad: z.boolean(),
});

export const reelsCheckSchema = z.strictObject({ name: z.string(), ok: z.boolean(), detail: z.string() });

export const reelsMatchDetailSchema = z.strictObject({
  contract_version: z.literal(REELS_CONTRACT_VERSION),
  match: z.strictObject({ id: z.number().int(), kickoff_utc: utc, league, referee: z.string().nullable() }),
  teams: z.strictObject({ home: team, away: team }),
  model: z.strictObject({ version: z.string(), computed_at: utc, simulations: z.number().int().nullable() }),
  outcome: z.strictObject({ home_win: z.number(), draw: z.number(), away_win: z.number() }),
  score_distribution: z.array(z.strictObject({ home_goals: z.number().int(), away_goals: z.number().int(), p: probability })),
  score_distribution_basis: z.enum(["aligned_to_outcome", "unavailable"]),
  score_scene_allowed: z.boolean(),
  goals: z.strictObject({ three_plus: z.number().nullable() }),
  recent_xg: z.strictObject({ home: z.number().nullable(), away: z.number().nullable(), window: z.string() }),
  both_score: z.number().nullable(),
  first_goal: z.strictObject({ home: z.number().nullable(), away: z.number().nullable(), none: z.number().nullable() }),
  scorers: z.array(scorer),
  season_xg_leaders: z.strictObject({
    home: z.array(xgLeader),
    away: z.array(xgLeader),
    data_updated_at: z.strictObject({ home: utc.nullable(), away: utc.nullable() }),
  }),
  form: z.strictObject({ home: z.string().nullable(), away: z.string().nullable() }),
  h2h: z.strictObject({
    played: z.number().int().nullable(),
    home_wins: z.number().int().nullable(),
    draws: z.number().int().nullable(),
    away_wins: z.number().int().nullable(),
  }),
  quality: z.strictObject({ stale: z.boolean(), checks: z.array(reelsCheckSchema) }),
});

export const reelsResultItemSchema = z.strictObject({
  match_id: z.number().int(),
  kickoff_utc: utc,
  home: z.string(),
  away: z.string(),
  final_score: z.strictObject({ home: z.number().int().nullable(), away: z.number().int().nullable() }),
  model_outcome: z.strictObject({ home_win: z.number(), draw: z.number(), away_win: z.number() }),
});

export type ReelsMatchListItem = z.infer<typeof reelsMatchListItemSchema>;
export type ReelsMatchDetail = z.infer<typeof reelsMatchDetailSchema>;
export type ReelsResultItem = z.infer<typeof reelsResultItemSchema>;
export type ReelsCheck = z.infer<typeof reelsCheckSchema>;

export type ReelsErrorCode =
  | "NOT_CONFIGURED" | "TIMEOUT" | "NETWORK" | "UNAUTHORIZED" | "NOT_FOUND" | "QUALITY_REJECTED" | "HTTP" | "CONTRACT" | "LANGUAGE";

export interface ReelsError {
  code: ReelsErrorCode;
  message: string;
}

/** Ağ/HTTP hatasının kullanıcıya gösterilen hâli. Anahtar ya da yanıt gövdesi mesaja girmez. */
export function reelsFailure(failure: HttpFailure): ReelsError {
  if (failure.kind === "TIMEOUT") return { code: "TIMEOUT", message: "Reels servisi zamanında yanıt vermedi. Tünel açık mı?" };
  if (failure.kind === "NETWORK") return { code: "NETWORK", message: "Reels servisine ulaşılamadı. Tünel ya da Mac kapalı olabilir." };
  if (failure.kind === "INVALID_JSON") return { code: "CONTRACT", message: "Reels servisi geçersiz yanıt döndürdü." };
  if (failure.status === 401) return { code: "UNAUTHORIZED", message: "Reels servisi anahtarı kabul etmedi (REELS_API_KEY)." };
  if (failure.status === 404) return { code: "NOT_FOUND", message: "Bu maç için analiz bulunamadı." };
  if (failure.status === 422) return { code: "QUALITY_REJECTED", message: "Reels servisi isteği reddetti: veri kalite kontrolünden geçmedi ya da istek geçersiz." };
  return { code: "HTTP", message: `Reels servisi hata döndürdü (HTTP ${failure.status ?? "?"}).` };
}

/** Yanıttaki bütün metin değerleri (alan adına bakılmaz; adresler ve harfsiz değerler kapıda elenir). */
export function reelsTextValues(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(reelsTextValues);
  if (value && typeof value === "object") return Object.values(value).flatMap(reelsTextValues);
  return [];
}

export function reelsLanguageProblem(value: unknown): string | null {
  return contentLanguageGate({ card: reelsTextValues(value) });
}

function contractFailure(what: string, error: z.ZodError): { ok: false; error: ReelsError } {
  const first = error.issues[0];
  const where = first?.path.length ? first.path.join(".") : "kök";
  return { ok: false, error: { code: "CONTRACT", message: `${what} sözleşmeye uymuyor (${where}: ${first?.message ?? "geçersiz"}).` } };
}

export function parseReelsMatchDetail(raw: unknown): Result<ReelsMatchDetail, ReelsError> {
  const parsed = reelsMatchDetailSchema.safeParse(raw);
  if (!parsed.success) return contractFailure("Maç yanıtı", parsed.error);
  const problem = reelsLanguageProblem(parsed.data);
  if (problem) return { ok: false, error: { code: "LANGUAGE", message: `Maç yanıtı reddedildi. ${problem}` } };
  return { ok: true, data: parsed.data };
}

export interface ReelsMatchList {
  matches: ReelsMatchListItem[];
  /** Dil kapısına takılıp listeden çıkarılan satır sayısı (ör. yasaklı sözcükle aynı adı taşıyan takım). */
  blocked: number;
}

/** Tek satır dil kapısına takılırsa bütün liste düşmez: satır çıkarılır, sayısı bildirilir. */
export function parseReelsMatchList(raw: unknown): Result<ReelsMatchList, ReelsError> {
  const parsed = z.array(reelsMatchListItemSchema).safeParse(raw);
  if (!parsed.success) return contractFailure("Maç listesi", parsed.error);
  const matches = parsed.data.filter((item) => reelsLanguageProblem(item) === null);
  return { ok: true, data: { matches, blocked: parsed.data.length - matches.length } };
}

export function parseReelsResults(raw: unknown): Result<ReelsResultItem[], ReelsError> {
  const parsed = z.array(reelsResultItemSchema).safeParse(raw);
  if (!parsed.success) return contractFailure("Sonuç listesi", parsed.error);
  const problem = reelsLanguageProblem(parsed.data);
  if (problem) return { ok: false, error: { code: "LANGUAGE", message: `Sonuç listesi reddedildi. ${problem}` } };
  return { ok: true, data: parsed.data };
}
