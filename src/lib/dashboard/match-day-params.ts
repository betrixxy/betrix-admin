import { z } from "zod";
import type { MatchDayParams } from "@/types/match-day";
import type { Result } from "@/types/result";

const text = (max: number) => z.string().trim().min(1).max(max);
const imageRef = z.string().trim().max(2048);

const matchDayParamsSchema = z.object({
  homeTeam: text(40),
  awayTeam: text(40),
  league: text(40).optional(),
  week: text(20).optional(),
  date: text(30).optional(),
  time: text(10).optional(),
  stadium: text(60).optional(),
  referee: text(50).optional(),
  homePlayerImg: imageRef.optional(),
  awayPlayerImg: imageRef.optional(),
  homeLogo: imageRef.optional(),
  awayLogo: imageRef.optional(),
});

/** Sorgu dizesini doğrular; boş bırakılan parametreler "verilmedi" sayılır. */
export function parseMatchDayParams(searchParams: URLSearchParams): Result<MatchDayParams> {
  const raw: Record<string, string> = {};
  for (const [key, value] of searchParams) {
    if (value.trim()) raw[key] = value;
  }

  const parsed = matchDayParamsSchema.safeParse(raw);
  if (!parsed.success) {
    const fields = [...new Set(parsed.error.issues.map((issue) => issue.path.join(".")))].join(", ");
    return { ok: false, error: { code: "INVALID_PARAMS", message: `Geçersiz veya eksik parametre: ${fields}` } };
  }
  return { ok: true, data: parsed.data };
}
