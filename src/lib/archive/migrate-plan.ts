/**
 * Eski kütüphaneden (`MediaAsset` PLAYER + MATCH_PHOTO) arşive taşıma planı — saf, veri kaybı yok:
 * eski kayıtlar silinmez, `Photo.legacyAssetId` ile bağlanır ve AYNI dosyayı gösterir (kopya yok,
 * `AiContent` referansları bozulmaz). LOGO ve REFERENCE taşınmaz (kütüphanede ayrı sekmede kalır).
 * Fal çağrısı yapılmaz — eski fotoğraflar kartta ilk kullanımda büyütülür.
 */

export interface LegacyAsset {
  id: string;
  category: "LOGO" | "PLAYER" | "MATCH_PHOTO" | "REFERENCE";
  label: string;
  fileUrl: string;
  /** Eski serbest metin alanı: takım kimliği ("645") ya da turnuva logosu ("league-203"). */
  teamId: string | null;
  playerId: number | null;
  playerName: string | null;
  fixtureId: string | null;
}

export type MigrationStep =
  | {
      kind: "MIGRATE";
      assetId: string;
      /** API-Football oyuncu kimliği; null = takım fotoğrafı. */
      personApiId: number | null;
      personName: string | null;
      teamId: number;
      kitTeamId: number;
      fixtureId: string | null;
      photoKind: "PORTRAIT" | "CELEBRATION";
      caption: string;
    }
  | { kind: "SKIP"; assetId: string; reason: string };

const numericTeam = (value: string | null) => (value && /^\d+$/.test(value) ? Number(value) : null);

/**
 * `knownTeams`: arşivde (senkron sonrası) oyuncunun güncel kulübü — eski kayıtta takım yoksa buradan.
 * Takımı belirlenemeyen kayıt atlanır, sebebiyle raporlanır (admin arşivde elle etiketler).
 */
export function planLegacyMigration(assets: LegacyAsset[], knownTeams: ReadonlyMap<number, number>, alreadyMigrated: ReadonlySet<string>): MigrationStep[] {
  return assets.flatMap((asset): MigrationStep[] => {
    if (asset.category !== "PLAYER" && asset.category !== "MATCH_PHOTO") return [];
    if (alreadyMigrated.has(asset.id)) return [{ kind: "SKIP", assetId: asset.id, reason: "zaten taşınmış" }];
    if (asset.category === "PLAYER" && asset.playerId === null) return [{ kind: "SKIP", assetId: asset.id, reason: "oyuncu etiketi yok — kimin fotoğrafı bilinmiyor" }];
    const teamId = numericTeam(asset.teamId) ?? (asset.playerId !== null ? knownTeams.get(asset.playerId) : undefined) ?? null;
    if (teamId === null) return [{ kind: "SKIP", assetId: asset.id, reason: "takım belirlenemedi — arşivde elle etiketlenmeli" }];
    return [
      {
        kind: "MIGRATE",
        assetId: asset.id,
        personApiId: asset.playerId,
        personName: asset.playerName,
        teamId,
        // Eski kayıtta forma bilgisi yok: çekildiği takımın klasörüyle aynı kabul edilir.
        kitTeamId: teamId,
        fixtureId: asset.fixtureId,
        photoKind: asset.category === "MATCH_PHOTO" ? "CELEBRATION" : "PORTRAIT",
        caption: asset.label,
      },
    ];
  });
}
