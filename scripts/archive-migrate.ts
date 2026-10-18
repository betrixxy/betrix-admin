/**
 * Eski kütüphaneden (MediaAsset PLAYER + MATCH_PHOTO) fotoğraf arşivine taşıma — idempotent,
 * veri kaybı yok (eski kayıtlar silinmez; `Photo.legacyAssetId` + aynı dosya). Fal çağrısı YOK.
 *
 *   # Kuru çalıştırma (varsayılan) — hiçbir şey yazmaz, planı ve raporu basar:
 *   npx tsx --env-file=.env --env-file=.env.local scripts/archive-migrate.ts
 *   # DB'siz kuru çalıştırma — dışa aktarılmış MediaAsset satırlarıyla (JSON dizi):
 *   npx tsx scripts/archive-migrate.ts --assets-json assets.json
 *   # Uygula — eksik takım/kişiyi API'den tamamlar (yalnızca okuma), Photo kayıtlarını yazar:
 *   npx tsx --env-file=... scripts/archive-migrate.ts --apply
 */
import { readFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { planLegacyMigration, type LegacyAsset, type MigrationStep } from "@/lib/archive/migrate-plan";

const { values } = parseArgs({ options: { apply: { type: "boolean", default: false }, "assets-json": { type: "string" } } });

function printPlan(steps: MigrationStep[]) {
  const migrate = steps.filter((step) => step.kind === "MIGRATE");
  const skip = steps.filter((step) => step.kind === "SKIP");
  console.log(`Taşınacak: ${migrate.length} · Atlanacak: ${skip.length} · Fal çağrısı: 0 (eski fotoğraflar kartta ilk kullanımda büyütülür)`);
  for (const step of migrate) {
    if (step.kind !== "MIGRATE") continue;
    console.log(`  + ${step.assetId}  ${step.photoKind.padEnd(11)} takım ${step.teamId}  kişi ${step.personApiId ?? "— (takım fotoğrafı)"} ${step.personName ?? ""}  ${step.fixtureId ?? ""}`);
  }
  for (const step of skip) if (step.kind === "SKIP") console.log(`  - ${step.assetId}  ATLANDI: ${step.reason}`);
}

async function main() {
  if (values["assets-json"]) {
    const assets = JSON.parse(await readFile(values["assets-json"], "utf8")) as LegacyAsset[];
    printPlan(planLegacyMigration(assets, new Map(), new Set()));
    return;
  }

  const { prisma } = await import("@/lib/prisma");
  const { syncTeam } = await import("@/lib/archive/sync");
  const rows = await prisma.mediaAsset.findMany({ where: { category: { in: ["PLAYER", "MATCH_PHOTO"] } }, orderBy: { createdAt: "asc" } });
  const people = await prisma.person.findMany({ where: { role: "PLAYER", currentTeamId: { not: null } }, select: { apiId: true, currentTeamId: true } });
  const migrated = await prisma.photo.findMany({ where: { legacyAssetId: { not: null } }, select: { legacyAssetId: true } });
  const steps = planLegacyMigration(
    rows,
    new Map(people.flatMap((person) => (person.currentTeamId === null ? [] : [[person.apiId, person.currentTeamId] as const]))),
    new Set(migrated.flatMap((photo) => (photo.legacyAssetId ? [photo.legacyAssetId] : []))),
  );
  printPlan(steps);
  if (!values.apply) {
    console.log("\nKuru çalıştırma — hiçbir şey yazılmadı. Uygulamak için --apply.");
    return;
  }

  const byId = new Map(rows.map((row) => [row.id, row]));
  let written = 0;
  for (const step of steps) {
    if (step.kind !== "MIGRATE") continue;
    const asset = byId.get(step.assetId);
    if (!asset) continue;
    // Takım ve kadrosu yoksa API'den (yalnızca okuma; 7 gün içinde senkronlandıysa istek yok).
    if (!(await prisma.team.findUnique({ where: { id: step.teamId } }))) {
      const synced = await syncTeam(step.teamId);
      if (!synced.ok) {
        console.log(`  ! ${step.assetId}: takım ${step.teamId} alınamadı — ${synced.error.message}`);
        continue;
      }
    }
    let personId: string | null = null;
    if (step.personApiId !== null) {
      const person =
        (await prisma.person.findUnique({ where: { apiId_role: { apiId: step.personApiId, role: "PLAYER" } } })) ??
        (await prisma.person.create({
          data: { apiId: step.personApiId, role: "PLAYER", apiName: step.personName ?? String(step.personApiId), officialName: step.personName ?? String(step.personApiId), currentTeamId: step.teamId },
        }));
      personId = person.id;
    }
    // Aynı dosya eski kütüphanede iki klasörde (PLAYER + MATCH_PHOTO) olabilir: (sha256, kişi, takım) tekil.
    const duplicate = await prisma.photo.findFirst({ where: { sha256: asset.sha256, personId, teamId: step.teamId }, select: { id: true } });
    if (duplicate) {
      console.log(`  = ${step.assetId}: aynı fotoğraf zaten arşivde (${duplicate.id}) — atlandı`);
      continue;
    }
    await prisma.photo.upsert({
      where: { legacyAssetId: asset.id },
      update: {},
      create: {
        legacyAssetId: asset.id,
        personId,
        teamId: step.teamId,
        kitTeamId: step.kitTeamId,
        fixtureId: step.fixtureId,
        kind: step.photoKind,
        caption: step.caption,
        originalUrl: asset.fileUrl,
        sha256: asset.sha256,
        contentType: asset.contentType,
        width: asset.width,
        height: asset.height,
        sizeBytes: asset.sizeBytes,
        uploadedAt: asset.createdAt,
      },
    });
    written += 1;
  }
  console.log(`\nYazıldı: ${written} fotoğraf.`);
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (!values["assets-json"]) await (await import("@/lib/prisma")).prisma.$disconnect();
  });
