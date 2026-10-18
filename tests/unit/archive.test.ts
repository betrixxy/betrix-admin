import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { planLegacyMigration, type LegacyAsset } from "@/lib/archive/migrate-plan";
import { ARCHIVE_TEAM_NAMES, cardTeamName, compareTr, displayPersonName, NATIONAL_ROOT_NAME, officialLeagueName, officialPersonName, officialTeamName } from "@/lib/archive/names";
import { archiveUpscaleFactor } from "@/lib/archive/storage";
import { isOldKit, planTransfer } from "@/lib/archive/transfer";
import { orderPickerPhotos, photoBucket } from "@/lib/archive/picker-order";
import { ARCHIVE_GROUPS, ARCHIVE_GROUP_LABELS, clubTeamDecision, currentCoach, domesticLeague, groupPeople, positionFromApi } from "@/lib/archive/structure";

describe("arşiv — isim disiplini", () => {
  it("lig ve takım resmi adları tek kaynaktan; tabloda olmayan takım Türkçe eşleme → API adı", () => {
    assert.equal(officialLeagueName(203, "Süper Lig"), "Trendyol Süper Lig");
    assert.equal(officialLeagueName(78, "Bundesliga"), "Bundesliga");
    assert.equal(officialLeagueName(0, ""), NATIONAL_ROOT_NAME);
    assert.equal(officialTeamName(549, "Beşiktaş"), "Beşiktaş JK");
    assert.equal(officialTeamName(167, "1899 Hoffenheim"), "TSG Hoffenheim");
    assert.equal(officialTeamName(999_001, "Fatih Karagumruk"), "Fatih Karagümrük");
    assert.equal(officialTeamName(999_002, "Some FC"), "Some FC");
  });

  it("arşiv adı ≠ kart adı: arşiv resmi kısa ad, kart mevcut Türkçe eşleme (tablo kartı etkilemez)", () => {
    assert.deepEqual([officialTeamName(549, "Beşiktaş"), cardTeamName("Beşiktaş")], ["Beşiktaş JK", "Beşiktaş"]);
    assert.deepEqual([officialTeamName(645, "Galatasaray"), cardTeamName("Galatasaray")], ["Galatasaray SK", "Galatasaray"]);
    assert.equal(cardTeamName("Gençlerbirliği S.K."), "Gençlerbirliği");
  });

  it("kart adı = medyada yaygın ad: Gaziantep FK, Çorum FK, Bodrum FK ekiyle; Erzurumspor, Vanspor eksiz; Manisa FK", () => {
    assert.deepEqual(
      ["Gaziantep FK", "Çorum FK", "Bodrum FK", "Erzurumspor FK", "Vanspor FK", "Manisa F.K."].map(cardTeamName),
      ["Gaziantep FK", "Çorum FK", "Bodrum FK", "Erzurumspor", "Vanspor", "Manisa FK"],
    );
  });

  it("TFF'den doğrulanan ve kullanıcı onaylı arşiv adları; işaretli satır kalmadı", () => {
    assert.deepEqual(
      [3579, 3595, 6533, 3605, 3583, 1007, 7402].map((id) => [ARCHIVE_TEAM_NAMES[id]?.archiveName, ARCHIVE_TEAM_NAMES[id]?.verified]),
      [
        ["Amed SFK", true],
        ["Ankara Keçiörengücü", true],
        ["Mardin 1969 Spor", true],
        ["Sarıyer", true],
        ["Bodrum FK", true],
        ["Çaykur Rizespor", true],
        ["Esenler Erokspor", true],
      ],
    );
    assert.deepEqual(
      Object.entries(ARCHIVE_TEAM_NAMES)
        .filter(([, entry]) => !entry.verified)
        .map(([id]) => Number(id)),
      [],
    );
    assert.deepEqual([ARCHIVE_TEAM_NAMES[994]?.archiveName, ARCHIVE_TEAM_NAMES[3589]?.archiveName], ["Göztepe SK", "Fatih Karagümrük SK"]);
  });

  it("arşiv adlarında sponsor yok; Trendyol Süper Lig (18) ve 1. Lig (20) tam kapsanır", () => {
    const sponsors = /trendyol|rams|tümosan|reeder|sipay|net global|corendon|atakaş|ikas|zecorner|hesap.com|bitexen|siltaş|onvo|kasımpaşa spor a.ş/i;
    for (const [id, entry] of Object.entries(ARCHIVE_TEAM_NAMES)) assert.ok(!sponsors.test(entry.archiveName), `${id}: ${entry.archiveName}`);
    const superLig = [996, 3579, 564, 549, 6343, 1009, 3588, 611, 645, 3573, 997, 994, 1004, 7411, 607, 1007, 3603, 998];
    const firstLeague = [1005, 3584, 7395, 3583, 3569, 1003, 7402, 3589, 17259, 3578, 1001, 3595, 3597, 6533, 7414, 3601, 3605, 1002, 3577, 6342];
    for (const id of [...superLig, ...firstLeague]) assert.ok(ARCHIVE_TEAM_NAMES[id], `eksik takım ${id}`);
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

describe("arşiv — transfer", () => {
  const photos = [
    { id: "kulup-1", teamId: 549, kitTeamId: 549 },
    { id: "kulup-2", teamId: 549, kitTeamId: 549 },
    { id: "milli", teamId: 777, kitTeamId: 777 },
    { id: "eski-kiralik", teamId: 549, kitTeamId: 645 },
  ];

  it("eski kulüp klasöründekiler yeni kulübe geçer, formaları aynı kalır; milli takım klasörü dokunulmaz", () => {
    const plan = planTransfer(photos, 549, 611);
    assert.deepEqual(plan.moveIds, ["kulup-1", "kulup-2", "eski-kiralik"]);
    assert.deepEqual(plan.oldKitIds, ["kulup-1", "kulup-2", "eski-kiralik"]);
  });

  it("aynı takıma ya da takımsız kişiden transfer hiçbir şeyi taşımaz", () => {
    assert.deepEqual(planTransfer(photos, 549, 549), { moveIds: [], oldKitIds: [] });
    assert.deepEqual(planTransfer(photos, null, 611), { moveIds: [], oldKitIds: [] });
  });

  it("eski forma rozeti: forma takımı klasör takımından farklıysa", () => {
    assert.equal(isOldKit({ teamId: 611, kitTeamId: 549 }), true);
    assert.equal(isOldKit({ teamId: 549, kitTeamId: 549 }), false);
  });
});

describe("arşiv — stüdyo seçici sırası", () => {
  const photo = (id: string, kitTeamId: number, uploadedAt: string, fixtureId: string | null = null) => ({ id, kitTeamId, uploadedAt, fixtureId });

  it("önce bu maç, sonra güncel formalı en yeniler, en altta eski forma", () => {
    const photos = [
      photo("eski-yeni", 645, "2026-10-10"),
      photo("guncel-eski", 549, "2026-01-01"),
      photo("bu-mac", 645, "2025-05-01", "api-football-900"),
      photo("guncel-yeni", 549, "2026-09-01"),
      photo("eski-eski", 645, "2024-01-01"),
    ];
    assert.deepEqual(orderPickerPhotos(photos, 549, "api-football-900").map((entry) => entry.id), ["bu-mac", "guncel-yeni", "guncel-eski", "eski-yeni", "eski-eski"]);
  });

  it("maç yoksa 'bu maç' kovası boş; başka maçın fotoğrafı formaya göre sıralanır", () => {
    assert.equal(photoBucket(photo("x", 549, "2026-01-01", "api-football-1"), 549, null), "CURRENT_KIT");
    assert.equal(photoBucket(photo("x", 645, "2026-01-01", "api-football-1"), 549, "api-football-2"), "OLD_KIT");
    assert.equal(photoBucket(photo("x", 645, "2026-01-01", "api-football-2"), 549, "api-football-2"), "THIS_MATCH");
  });
});
