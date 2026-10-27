import { z } from "zod";
import { DRAW_STAGES, DRAW_VARIANTS, type DrawState } from "@/types/draw";

/**
 * Kura durumunun şeması — istemciden gelen (stüdyo) ve kayıttan okunan (`renderOptions.states`) durum bununla
 * doğrulanır. Sınırlar kuranın gerçek boyutundan geniş, kötüye kullanıma dar.
 */

const iso = z.string().datetime({ offset: true }).nullable();

export const drawTeamSchema = z.object({
  id: z.number().int().positive(),
  apiName: z.string().trim().min(1).max(80),
  country: z.string().max(60).nullable(),
  logoUrl: z.string().url().max(500).nullable(),
  pot: z.number().int().min(1).max(6).nullable(),
});

export const drawStateSchema = z.object({
  competition: z.object({ id: z.number().int().positive(), name: z.string().trim().min(1).max(80) }),
  season: z.number().int().min(2000).max(2100),
  roundLabel: z.string().trim().min(1).max(60),
  stage: z.enum(DRAW_STAGES),
  drawDateUtc: iso,
  teams: z.array(drawTeamSchema).max(100),
  ties: z.array(z.object({ first: z.number().int().positive(), second: z.number().int().positive(), firstLegUtc: iso, secondLegUtc: iso })).max(64),
  fixtures: z.array(z.object({ teamId: z.number().int().positive(), opponentId: z.number().int().positive(), venue: z.enum(["HOME", "AWAY"]), dateUtc: iso })).max(400),
  // JSON anahtarı metindir ("611"); `Record<number, string>` ile aynı nesne.
  nameOverrides: z.record(z.string().regex(/^\d+$/), z.string().trim().max(40)),
});

// Şema kanonik tiple birebir (derleme zamanı denetimi).
export const asDrawState = (state: z.infer<typeof drawStateSchema>): DrawState => state;

/** Stüdyonun çizim isteği (önizleme ve kayıt aynı). */
export const drawRequestSchema = z.object({
  variant: z.enum(DRAW_VARIANTS),
  format: z.enum(["IG_PORTRAIT", "IG_SQUARE", "STORY", "X_LANDSCAPE"]),
  /** A ve C: ilk durum; B: aynı sezonun bütün kuraları. */
  states: z.array(drawStateSchema).min(1).max(3),
  /** Kayıttaki tur kimlikleri (`rounds.ts`), durumlarla aynı sırada. */
  roundIds: z.array(z.string().max(8)).min(1).max(3),
  focusTeamId: z.number().int().positive().nullable(),
});
export type DrawRequest = z.infer<typeof drawRequestSchema>;
