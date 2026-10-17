import { prisma } from "@/lib/prisma";
import { watchSnapshot } from "@/lib/dashboard/watched-snapshot";
import type { Fixture } from "@/types/sports";

/**
 * Yıldızlı maçlar (`WatchedFixture`) — İçerik Planı'nın kaynağı. Anlık görüntü yalnızca sunucuda,
 * sağlayıcıdan yeniden çekilmiş `Fixture`'dan yazılır (istemciden gelen maç bilgisine güvenilmez).
 */

/** Verilen maçlardan yıldızlı olanların kimlikleri. */
export async function getWatchedIds(fixtureIds: string[]): Promise<Set<string>> {
  if (fixtureIds.length === 0) return new Set();
  const rows = await prisma.watchedFixture.findMany({ where: { fixtureId: { in: fixtureIds } }, select: { fixtureId: true } });
  return new Set(rows.map((row) => row.fixtureId));
}

/** Yıldızla (anlık görüntüyü tazeler) — idempotent. */
export async function watchFixture(fixture: Fixture): Promise<void> {
  const snapshot = watchSnapshot(fixture);
  await prisma.watchedFixture.upsert({ where: { fixtureId: fixture.id }, create: { fixtureId: fixture.id, ...snapshot }, update: snapshot });
}

/** Yıldızı kaldır — maçın içerikleri ve planları silinmez. */
export async function unwatchFixture(fixtureId: string): Promise<void> {
  await prisma.watchedFixture.deleteMany({ where: { fixtureId } });
}
