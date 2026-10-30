import { CLUB_COLORS, registerClubColors } from "@/lib/dashboard/club-colors";
import { isHex } from "@/lib/dashboard/color-math";
import { logoSwatches } from "@/lib/dashboard/logo-swatches";
import { resolveImage } from "@/lib/dashboard/match-day-assets";
import { logoTeamColors } from "@/lib/dashboard/team-color-pick";
import { prisma } from "@/lib/prisma";

/**
 * Takım rengi kaynağı — sunucu tarafı (kurucu kararı 2026-10-30: BÜTÜN kartlar aynı kaynaktan). Kod tablosu
 * (`club-colors.ts`) önce; tabloda olmayan takımın rengi `TeamColor` kaydından (APPROVED = onaylı, AUTO =
 * logodan otomatik), kayıt yoksa logodan ŞİMDİ çıkarılır ve AUTO olarak yazılır (admin Ad Raporu'nda onaylar).
 * Kart çizen her akış önce `warmTeamColors` çağırır; sonra saf `clubColors()` bu renkleri görür. Logo okunamazsa
 * ya da okunur renk yoksa kayıt açılmaz — kart nötr beyaz çizer (asla altın/marka rengi).
 */

export interface TeamColorRef {
  id: number;
  name: string;
  logoUrl?: string | null | undefined;
}

export async function warmTeamColors(teams: readonly TeamColorRef[]): Promise<void> {
  const missing = teams.filter((team) => team.id > 0 && !CLUB_COLORS[team.id]);
  if (missing.length === 0) return;
  try {
    const rows = await prisma.teamColor.findMany({ where: { teamId: { in: missing.map((team) => team.id) } } });
    for (const row of rows) registerClubColors(row.teamId, { name: row.teamName, primary: row.primary, secondary: row.secondary }, row.status);
    const known = new Set(rows.map((row) => row.teamId));
    for (const team of missing.filter((candidate) => !known.has(candidate.id) && candidate.logoUrl)) {
      const logo = await resolveImage(team.logoUrl ?? undefined, 300);
      const colors = logo ? logoTeamColors(await logoSwatches(team.logoUrl ?? "", logo)) : null;
      if (!colors) continue;
      // Aynı anda iki akış çıkarırsa ilk yazan kalır; onaylı kayıt asla ezilmez.
      await prisma.teamColor.upsert({ where: { teamId: team.id }, create: { teamId: team.id, teamName: team.name, ...colors, logoUrl: team.logoUrl ?? null }, update: {} });
      registerClubColors(team.id, { name: team.name, ...colors }, "AUTO");
    }
  } catch (cause) {
    console.error("[team-colors] takım rengi okunamadı/yazılamadı:", cause);
  }
}

export interface AutoTeamColor {
  teamId: number;
  teamName: string;
  primary: string;
  secondary: string;
  logoUrl: string | null;
  createdAt: string;
}

/** Ad Raporu "Otomatik renkler": onay bekleyen (AUTO) kayıtlar, en yeni önce. */
export async function listAutoTeamColors(): Promise<AutoTeamColor[]> {
  const rows = await prisma.teamColor.findMany({ where: { status: "AUTO" }, orderBy: { createdAt: "desc" } });
  return rows.map((row) => ({ teamId: row.teamId, teamName: row.teamName, primary: row.primary, secondary: row.secondary, logoUrl: row.logoUrl, createdAt: row.createdAt.toISOString() }));
}

/** Onay (gerekirse düzeltilmiş renklerle) — kayıt APPROVED olur, kulüp tablosu gibi kullanılır. */
export async function approveTeamColor(teamId: number, primary: string, secondary: string): Promise<boolean> {
  if (!isHex(primary) || !isHex(secondary)) return false;
  const updated = await prisma.teamColor.updateMany({ where: { teamId }, data: { primary: primary.toUpperCase(), secondary: secondary.toUpperCase(), status: "APPROVED" } });
  if (updated.count > 0) {
    const row = await prisma.teamColor.findUnique({ where: { teamId } });
    if (row) registerClubColors(teamId, { name: row.teamName, primary: row.primary, secondary: row.secondary }, "APPROVED");
  }
  return updated.count > 0;
}
