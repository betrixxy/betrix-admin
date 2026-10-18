import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { planLegacyMigration, type LegacyAsset } from "@/lib/archive/migrate-plan";
import { compareTr, displayPersonName, NATIONAL_ROOT_NAME, officialLeagueName, officialPersonName, officialTeamName } from "@/lib/archive/names";
import { archiveUpscaleFactor } from "@/lib/archive/storage";
import { ARCHIVE_GROUPS, ARCHIVE_GROUP_LABELS, clubTeamDecision, currentCoach, domesticLeague, groupPeople, positionFromApi } from "@/lib/archive/structure";

describe("arşiv — isim disiplini", () => {
  it("lig ve takım resmi adları tek kaynaktan; tabloda olmayan takım Türkçe eşleme → API adı", () => {
    assert.equal(officialLeagueName(203, "Süper Lig"), "Trendyol Süper Lig");
    assert.equal(officialLeagueName(78, "Bundesliga"), "Bundesliga");
    assert.equal(officialLeagueName(0, ""), NATIONAL_ROOT_NAME);
    assert.equal(officialTeamName(549, "Besiktas"), "Beşiktaş JK");
    assert.equal(officialTeamName(167, "1899 Hoffenheim"), "TSG Hoffenheim");
    assert.equal(officialTeamName(999_001, "Fatih Karagumruk"), "Fatih Karagümrük");
    assert.equal(officialTeamName(999_002, "Some FC"), "Some FC");
  });

  it("kısaltılmış kadro adı sezon verisindeki adla açılır; Türkçe karakterler korunur", () => {
    assert.equal(officialPersonName("O. Kökçü", "Orkun", "Kökçü"), "Orkun Kökçü");
    assert.equal(officialPersonName("O. Kökçü", "Mehmet Orkun", "Kökçü"), "Orkun Kökçü");
    assert.equal(officialPersonName("İ. Eğribayat", "İrfan Can", "Eğribayat"), "İrfan Eğribayat");
    assert.equal(officialPersonName("Vinícius Júnior", "Vinícius José", "Paixão de Oliveira Júnior"), "Vinícius Júnior");
    assert.equal(officialPersonName("A. Güler", null, null), "A. Güler");
  });

  it("admin düzeltmesi her zaman kazanır", () => {
    assert.equal(displayPersonName({ officialName: "İrfan Eğribayat", nameOverride: "İrfan Can Eğribayat" }), "İrfan Can Eğribayat");
    assert.equal(displayPersonName({ officialName: "Orkun Kökçü", nameOverride: null }), "Orkun Kökçü");
    assert.equal(displayPersonName({ officialName: "Orkun Kökçü", nameOverride: "  " }), "Orkun Kökçü");
  });

  it("tr-TR sıralama: Ç, İ, Ö, Ş, Ü doğru yerde", () => {
    assert.deepEqual(["Şahin", "Ozan", "Çağlar", "Cenk", "İsmail", "Ismail", "Ömer", "Uğur", "Ümit"].sort(compareTr), ["Cenk", "Çağlar", "Ismail", "İsmail", "Ozan", "Ömer", "Şahin", "Uğur", "Ümit"]);
  });
});

describe("arşiv — klasör yapısı", () => {
  it("mevki eşleme", () => {
    assert.deepEqual(["Goalkeeper", "Defender", "Midfielder", "Attacker", "", null].map(positionFromApi), ["GK", "DEF", "MID", "FWD", null, null]);
  });

  it("gruplar sabit sırada, grup içinde tr-TR alfabetik; boş gruplar da döner", () => {
    const groups = groupPeople([
      { role: "PLAYER" as const, position: "MID" as const, name: "Salih Özcan" },
      { role: "PLAYER" as const, position: "MID" as const, name: "Orkun Kökçü" },
      { role: "COACH" as const, position: null, name: "Vincenzo Italiano" },
      { role: "PLAYER" as const, position: "GK" as const, name: "Ersin Destanoğlu" },
    ]);
    assert.deepEqual(groups.map((group) => group.label), ["Takım Fotoğrafları", "Teknik Direktör", "Kaleciler", "Defans", "Orta Saha", "Forvet"]);
    assert.deepEqual(ARCHIVE_GROUPS.map((group) => ARCHIVE_GROUP_LABELS[group]), groups.map((group) => group.label));
    assert.deepEqual(groups.find((group) => group.group === "MID")?.people.map((person) => person.name), ["Orkun Kökçü", "Salih Özcan"]);
    assert.deepEqual(groups.find((group) => group.group === "COACH")?.people.map((person) => person.name), ["Vincenzo Italiano"]);
    assert.deepEqual(groups.find((group) => group.group === "DEF")?.people, []);
  });

  it("takımın ligi o sezonun yurt içi ligi — kupa/UEFA değil; küme düşen takım yeni ligiyle", () => {
    const entries = [
      { id: 2, name: "UEFA Champions League", type: "Cup", country: "World", logo: null },
      { id: 206, name: "Türkiye Kupası", type: "Cup", country: "Turkey", logo: null },
      { id: 203, name: "Süper Lig", type: "League", country: "Turkey", logo: null },
    ];
    assert.equal(domesticLeague(entries, "Turkey")?.id, 203);
    const relegated = [{ id: 204, name: "1. Lig", type: "League", country: "Turkey", logo: null }, { id: 206, name: "Türkiye Kupası", type: "Cup", country: "Turkey", logo: null }];
    assert.equal(domesticLeague(relegated, "Turkey")?.id, 204);
    assert.equal(domesticLeague([{ id: 2, name: "UCL", type: "Cup", country: "World" }], "Turkey"), null);
  });

  it("güncel teknik direktör: bu takımla bitiş tarihi olmayan kariyer kaydı", () => {
    const coaches = [
      { id: 1, name: "Eski Hoca", firstname: null, lastname: null, career: [{ team: { id: 549 }, start: "2024-07-01", end: "2025-06-01" }] },
      { id: 2, name: "V. Italiano", firstname: "Vincenzo", lastname: "Italiano", career: [{ team: { id: 549 }, start: "2025-07-01", end: null }] },
    ];
    assert.equal(currentCoach(coaches, 549)?.id, 2);
    assert.equal(currentCoach(coaches, 645), null);
  });

  it("transfer: otomatik taşıma YOK — başka takım kadrosu yalnızca öneri", () => {
    assert.deepEqual(clubTeamDecision(null, 549), { kind: "ASSIGN", teamId: 549 });
    assert.deepEqual(clubTeamDecision(549, 549), { kind: "KEEP" });
    assert.deepEqual(clubTeamDecision(549, 645), { kind: "SUGGEST", teamId: 645 });
  });
});

describe("arşiv — kalite", () => {
  it("kısa kenar < 2000 → ESRGAN katsayısı (en fazla 4); yeterliyse 1", () => {
    assert.equal(archiveUpscaleFactor(3000, 2000), 1);
    assert.equal(archiveUpscaleFactor(1024, 683), 3);
    assert.equal(archiveUpscaleFactor(1600, 1900), 2);
    assert.equal(archiveUpscaleFactor(400, 300), 4);
  });
});

describe("arşiv — eski kütüphaneden taşıma planı", () => {
  const asset = (id: string, overrides: Partial<LegacyAsset>): LegacyAsset => ({
    id,
    category: "PLAYER",
    label: id,
    fileUrl: `/api/files/library/${id}.jpg`,
    teamId: null,
    playerId: null,
    playerName: null,
    fixtureId: null,
    ...overrides,
  });

  it("oyuncu fotoğrafı portre, maç fotoğrafı sevinç; takım eski etiketten ya da kişinin güncel kulübünden", () => {
    const steps = planLegacyMigration(
      [
        asset("a", { playerId: 62137, playerName: "İrfan Can Eğribayat", teamId: "997" }),
        asset("b", { category: "MATCH_PHOTO", playerId: 34710, fixtureId: "api-football-1584435" }),
        asset("c", { category: "LOGO", teamId: "645" }),
      ],
      new Map([[34710, 549]]),
      new Set(),
    );
    assert.deepEqual(
      steps.map((step) => (step.kind === "MIGRATE" ? [step.assetId, step.photoKind, step.teamId, step.kitTeamId, step.personApiId] : [step.assetId, step.reason])),
      [
        ["a", "PORTRAIT", 997, 997, 62137],
        ["b", "CELEBRATION", 549, 549, 34710],
      ],
    );
  });

  it("takımı belirlenemeyen ya da oyuncusuz portre atlanır (sebepli); taşınmış olan tekrar taşınmaz; logo etiketi takım sayılmaz", () => {
    const steps = planLegacyMigration(
      [asset("x", { category: "MATCH_PHOTO", fixtureId: "api-football-1" }), asset("y", {}), asset("z", { playerId: 5, teamId: "645" }), asset("w", { playerId: 6, teamId: "league-203" })],
      new Map(),
      new Set(["z"]),
    );
    assert.deepEqual(
      steps.map((step) => (step.kind === "SKIP" ? [step.assetId, step.reason] : [step.assetId, "MIGRATE"])),
      [
        ["x", "takım belirlenemedi — arşivde elle etiketlenmeli"],
        ["y", "oyuncu etiketi yok — kimin fotoğrafı bilinmiyor"],
        ["z", "zaten taşınmış"],
        ["w", "takım belirlenemedi — arşivde elle etiketlenmeli"],
      ],
    );
  });
});
