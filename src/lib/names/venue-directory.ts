import { prisma } from "@/lib/prisma";

/** Stadyum adı admin düzeltmeleri (`VenueName`) — okunamazsa boş (kart tablo/kuralla devam eder). */
export async function loadVenueOverrides(): Promise<Map<string, string>> {
  try {
    const rows = await prisma.venueName.findMany({ select: { apiName: true, displayName: true } });
    return new Map(rows.map((row) => [row.apiName, row.displayName]));
  } catch (cause) {
    console.error("[venue-names] düzeltmeler okunamadı:", cause);
    return new Map();
  }
}

/** Düzeltmeyi yazar; boş ad düzeltmeyi kaldırır (tablo/kural geri gelir). */
export async function setVenueOverride(apiName: string, displayName: string): Promise<void> {
  const key = apiName.trim();
  const name = displayName.replace(/\s+/gu, " ").trim();
  if (!name) {
    await prisma.venueName.deleteMany({ where: { apiName: key } });
    return;
  }
  await prisma.venueName.upsert({ where: { apiName: key }, create: { apiName: key, displayName: name }, update: { displayName: name } });
}
