import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assignRole, byRole, DEFAULT_ROLE_STATE, FIXED_OPEN, ROLE_CAPACITY, selectionIssues, type BoxRole, type RoleState } from "@/lib/prediction/vitrin-roles";
import { SCENARIO_IDS, type ScenarioId } from "@/types/prediction";

/**
 * Vitrin stüdyosu kutu rolleri (2026-10-20): sayılar her zaman geçerli, pasif butonun nedeni her zaman
 * okunur cümleyle listelenir.
 */

const counts = (state: RoleState) => ({ open: byRole(state.roles, "open").length, locked: byRole(state.roles, "locked").length, none: byRole(state.roles, "none").length });
const allRoles = (role: BoxRole) => Object.fromEntries(SCENARIO_IDS.map((id) => [id, role])) as Record<ScenarioId, BoxRole>;
const empty = <T>(value: T) => Object.fromEntries(SCENARIO_IDS.map((id) => [id, value])) as Record<ScenarioId, T>;

describe("rol ataması — kapasite sabit, en eski seçim yer değiştirir", () => {
  it("üçüncü açık kutu: en eski açık seçim (1X2 hariç) seçilenin eski rolüne döner", () => {
    const next = assignRole(DEFAULT_ROLE_STATE, "HT_RESULT", "open");
    assert.equal(next.roles.HT_RESULT, "open");
    assert.equal(next.roles.BTTS, "locked", "BTTS, HT_RESULT'un eski rolünü (kilitli) aldı");
    assert.equal(next.roles.RESULT_1X2, "open");
    assert.deepEqual(counts(next), { open: 2, locked: 3, none: 1 });
  });

  it("her sırayla her atamada sayılar geçerli kalır; 1X2 hep açık", () => {
    let state = DEFAULT_ROLE_STATE;
    const roles: BoxRole[] = ["open", "locked", "none"];
    for (let step = 0; step < 60; step++) {
      const id = SCENARIO_IDS[(step * 7) % SCENARIO_IDS.length] as ScenarioId;
      state = assignRole(state, id, roles[(step * 5) % roles.length] as BoxRole);
      assert.deepEqual(counts(state), { open: ROLE_CAPACITY.open, locked: ROLE_CAPACITY.locked, none: ROLE_CAPACITY.none }, `adım ${step}`);
      assert.equal(state.roles[FIXED_OPEN], "open");
    }
  });

  it("kazanma olasılıklarının rolü değişmez", () => {
    assert.equal(assignRole(DEFAULT_ROLE_STATE, FIXED_OPEN, "locked"), DEFAULT_ROLE_STATE);
  });

  it("en eski seçim: son atanan korunur, önceki yer değiştirir", () => {
    const a = assignRole(DEFAULT_ROLE_STATE, "GOALS_3PLUS", "open"); // BTTS → none
    const b = assignRole(a, "COMBO", "open"); // tek değişebilir açık kutu GOALS_3PLUS → COMBO'nun eski rolüne (kilitli)
    assert.equal(b.roles.COMBO, "open");
    assert.equal(b.roles.GOALS_3PLUS, "locked");
    assert.deepEqual(counts(b), { open: 2, locked: 3, none: 1 });
  });
});

describe("pasif butonun nedenleri", () => {
  const titles = { ...empty(""), RESULT_1X2: "Kazanma olasılıkları", BTTS: "İki takım da gol bulur mu?", HT_RESULT: "İlk yarı kimin?" };
  const base = { loaded: true, busy: false, roles: DEFAULT_ROLE_STATE.roles, titles, reasons: { ...empty(""), RESULT_1X2: "Fenerbahçe son 5 maçında 4 galibiyet aldı.", BTTS: "Fenerbahçe maç başı 3,2 gol atıyor." }, serverIssues: empty<string[]>([]), edited: empty(false) };

  it("geçerli seçim ve temiz gerekçe → neden yok (buton etkin)", () => {
    assert.deepEqual(selectionIssues(base), []);
  });

  it("veri yüklenmemiş", () => {
    assert.deepEqual(selectionIssues({ ...base, loaded: false }), ["Önce maçı seçip “Veriyi yükle”ye basın."]);
  });

  it("birden fazla neden hepsi listelenir: fazla açık kutu, kilitli eksik, 1X2 kapalı", () => {
    const roles = { ...allRoles("open"), GOALS_4PLUS: "none" as const, RESULT_1X2: "locked" as const };
    const issues = selectionIssues({ ...base, roles });
    assert.ok(issues.includes("En fazla 2 açık kutu seçilebilir (şu an 4)."), issues.join(" | "));
    assert.ok(issues.includes("3 kilitli kutu gerekli (şu an 1)."), issues.join(" | "));
    assert.ok(issues.includes("Kazanma olasılıkları her zaman açık kutu olmalı (posterin çubuğu)."), issues.join(" | "));
  });

  it("açık kutunun gerekçesi: boş, sunucu denetimi, düzenlenince sözcük sınırı", () => {
    assert.ok(selectionIssues({ ...base, reasons: { ...base.reasons, BTTS: " " } }).includes("İki takım da gol bulur mu?: gerekçe boş."));
    const server = selectionIssues({ ...base, serverIssues: { ...base.serverIssues, BTTS: ["senaryoyla ilgisiz — gol atma ya da gol yeme verisine dayanmalı"] } });
    assert.ok(server.some((issue) => issue.startsWith("İki takım da gol bulur mu?: senaryoyla ilgisiz")), server.join(" | "));
    const long = "bir iki üç dört beş altı yedi sekiz dokuz on onbir";
    const edited = selectionIssues({ ...base, reasons: { ...base.reasons, BTTS: long }, edited: { ...base.edited, BTTS: true } });
    assert.ok(edited.includes("İki takım da gol bulur mu?: gerekçe 11 sözcük (en fazla 10)."), edited.join(" | "));
  });

  it("işlem sürüyor", () => {
    assert.ok(selectionIssues({ ...base, busy: true }).includes("Bir işlem sürüyor — bitmesini bekleyin."));
  });
});
