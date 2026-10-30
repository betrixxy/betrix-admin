import { z } from "zod";
import { apiFootballStatisticSchema } from "@/lib/services/api-football/types";

/**
 * `/fixtures/statistics?fixture=<id>&half=true` — ham yanıt (sağlayıcının şemasına birebir, yalnızca okunan
 * alanlar). `statistics` maç toplamı, `statistics_1h` / `statistics_2h` devre değerleri; devre bloğu yalnızca
 * kapsamı olan liglerde ve 2024 sonrası maçlarda gelir, yoksa alan hiç gelmez ya da boş dizidir. Değer sayı,
 * "47%" / "1.01" gibi metin ya da null (null = sağlayıcı vermedi; 0 sayılmaz).
 */
export const apiFootballHalfTeamStatisticsSchema = z.object({
  team: z.object({ id: z.number() }),
  statistics: z.array(apiFootballStatisticSchema).optional().default([]).catch([]),
  statistics_1h: z.array(apiFootballStatisticSchema).optional().default([]).catch([]),
  statistics_2h: z.array(apiFootballStatisticSchema).optional().default([]).catch([]),
});

export type ApiFootballHalfTeamStatisticsRaw = z.infer<typeof apiFootballHalfTeamStatisticsSchema>;

export const apiFootballHalfStatisticsResponseSchema = z.object({
  get: z.string(),
  results: z.number(),
  response: z.array(apiFootballHalfTeamStatisticsSchema),
});
