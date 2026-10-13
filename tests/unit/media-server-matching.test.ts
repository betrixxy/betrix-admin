import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { detectDateOrder, parseFmDate, readFmClubs, readFmPeople } from "@/lib/media-server/fm-export";
import { matchPlayers, strictNameTier } from "@/lib/media-server/match-players";
import { buildTeamAliases, matchTeams } from "@/lib/media-server/match-teams";
import { normalizeName } from "@/lib/media-server/names";
import type { FmClub, FmPerson, MediaApiPlayer, MediaApiTeam } from "@/types/media-server";

const TEAMS: MediaApiTeam[] = [
  { id: 40, name: "Liverpool", country: "England", leagueIds: [39] },
  { id: 541, name: "Real Madrid", country: "Spain", leagueIds: [140] },
  { id: 85, name: "Paris Saint Germain", country: "France", leagueIds: [61] },
  { id: 645, name: "Galatasaray", country: "Turkey", leagueIds: [203] },
];

function player(p: Partial<MediaApiPlayer> & Pick<MediaApiPlayer, "id" | "name">): MediaApiPlayer {
  return { firstname: null, lastname: null, birthDate: null, teamIds: [], number: null, ...p };
}

const PLAYERS: MediaApiPlayer[] = [
  player({ id: 306, name: "M. Salah", firstname: "Mohamed", lastname: "Salah Hamed Mahrous Ghaly", birthDate: "1992-06-15", teamIds: [40], number: 11 }),
  player({ id: 762, name: "Vinícius Júnior", firstname: "Vinícius José", lastname: "Paixão de Oliveira Júnior", birthDate: "2000-07-12", teamIds: [541] }),
  // Aynı ad + aynı doğum tarihi — kurgusal ikizler: asla otomatik eşleşmemeli.
  player({ id: 9001, name: "M. Dembélé", firstname: "Moussa", lastname: "Dembélé", birthDate: "1996-07-12", teamIds: [85] }),
  player({ id: 9002, name: "M. Dembélé", firstname: "Moussa", lastname: "Dembélé", birthDate: "1996-07-12", teamIds: [645] }),
  player({ id: 1100, name: "Mauro Icardi", firstname: "Mauro Emanuel", lastname: "Icardi Rivero", birthDate: "1993-02-19", teamIds: [645] }),
];

function fm(uid: string, name: string, dob: string | null, club: string | null = null): FmPerson {
  return { uid, name, dob, club };
}

const CTX = {
  teamNames: new Map(TEAMS.map((t) => [t.id, t.name])),
  teamAliases: buildTeamAliases(TEAMS, [], []),
};

describe("normalizeName", () => {
  it("aksan, Türkçe harf ve noktalamayı siler", () => {
    assert.equal(normalizeName("N'Golo Kanté"), "n golo kante");
    assert.equal(normalizeName("Barış Alper Yılmaz"), "baris alper yilmaz");
    assert.equal(normalizeName("Martin Ødegaard"), "martin odegaard");
  });
});

describe("FM tarih çözümleme", () => {
  it("tarih sırasını tespit eder ve çelişkide durur", () => {
    assert.deepEqual(detectDateOrder(["15/6/1992 (34 years old)", "1/2/2000"]), { ok: true, data: "DMY" });
    assert.equal(detectDateOrder(["15/6/1992", "6/15/1992"]).ok, false);
    assert.equal(detectDateOrder(["1/2/2000"]).ok, false);
  });

  it("geçersiz tarihi reddeder", () => {
    assert.equal(parseFmDate("15/6/1992 (34 years old)", "DMY"), "1992-06-15");
    assert.equal(parseFmDate("31/2/1992", "DMY"), null);
  });
});

describe("strictNameTier", () => {
  it("tam ad ve resmi ad parçalarını ayırır", () => {
    assert.equal(strictNameTier("Vinícius Júnior", PLAYERS[1]!), "EXACT");
    assert.equal(strictNameTier("Mohamed Salah", PLAYERS[0]!), "TOKENS");
    assert.equal(strictNameTier("Mo Salah", PLAYERS[0]!), null);
  });
});

describe("matchPlayers — sıfır hata", () => {
  it("tam ad + doğum tarihi → kesin", () => {
    const out = matchPlayers([fm("1", "Vinicius Junior", "2000-07-12")], PLAYERS, CTX);
    assert.deepEqual(out.certain.map((m) => [m.apiId, m.method]), [[762, "NAME_EXACT+DOB"]]);
  });

  it("isim parçaları + doğum tarihi kulüp doğrulanınca kesin, doğrulanmazsa manuel", () => {
    const ok = matchPlayers([fm("1", "Mohamed Salah", "1992-06-15", "Liverpool")], PLAYERS, CTX);
    assert.equal(ok.certain[0]?.method, "NAME_TOKENS+DOB+CLUB");
    const noClub = matchPlayers([fm("1", "Mohamed Salah", "1992-06-15", "Al Ittihad")], PLAYERS, CTX);
    assert.equal(noClub.certain.length, 0);
    assert.equal(noClub.manual[0]?.candidates[0]?.apiId, 306);
  });

  it("aynı isim + aynı doğum tarihli iki oyuncu → manuel, iki aday listelenir", () => {
    const out = matchPlayers([fm("1", "Moussa Dembélé", "1996-07-12")], PLAYERS, CTX);
    assert.equal(out.certain.length, 0);
    assert.deepEqual(out.manual[0]?.candidates.map((c) => c.apiId).sort(), [9001, 9002]);
  });

  it("doğum tarihi farklıysa isim tutsa bile kesinleşmez", () => {
    const out = matchPlayers([fm("1", "Mauro Icardi", "1993-02-20", "Galatasaray")], PLAYERS, CTX);
    assert.equal(out.certain.length, 0);
    assert.equal(out.manual[0]?.candidates[0]?.apiId, 1100);
  });

  it("doğum tarihi yoksa asla kesinleşmez", () => {
    const out = matchPlayers([fm("1", "Mauro Icardi", null)], PLAYERS, CTX);
    assert.equal(out.certain.length, 0);
    assert.equal(out.manual.length, 1);
  });

  it("aynı API oyuncusuna iki FM yüzü → ikisi de manuel (ters tekillik)", () => {
    const out = matchPlayers(
      [fm("1", "Vinicius Junior", "2000-07-12"), fm("2", "Vinícius Júnior", "2000-07-12")],
      PLAYERS,
      CTX,
    );
    assert.equal(out.certain.length, 0);
    assert.equal(out.manual.length, 2);
  });

  it("hiç benzeri olmayan FM kaydı kapsam dışıdır, manuele de düşmez", () => {
    const out = matchPlayers([fm("1", "Hakan Şükür", "1971-09-01")], PLAYERS, CTX);
    assert.deepEqual([out.certain.length, out.manual.length, out.outOfScope], [0, 0, 1]);
  });
});

describe("matchTeams — sıfır hata", () => {
  const club = (uid: string, name: string, nation: string | null, shortName: string | null = null): FmClub => ({ uid, name, nation, shortName });

  it("ad + ülke → kesin; ek atılmış ad → kesin; ülke farklıysa → değil", () => {
    const out = matchTeams(
      [club("1", "Liverpool", "England"), club("2", "Real Madrid CF", "Spain"), club("3", "Galatasaray", "Türkiye"), club("4", "Liverpool", "Uruguay")],
      TEAMS,
    );
    assert.deepEqual(
      out.certain.map((m) => [m.fmUid, m.apiId, m.method]),
      [["1", 40, "NAME_EXACT+COUNTRY"], ["2", 541, "NAME_AFFIX_STRIPPED+COUNTRY"], ["3", 645, "NAME_EXACT+COUNTRY"]],
    );
  });

  it("ülkesi bilinmeyen kulüp kesinleşmez", () => {
    const out = matchTeams([club("1", "Liverpool", null)], TEAMS);
    assert.equal(out.certain.length, 0);
    assert.equal(out.manual.length, 1);
  });

  it("aynı API takımına iki FM kulübü → ikisi de manuel", () => {
    const out = matchTeams([club("1", "Liverpool", "England"), club("2", "Liverpool FC", "England")], TEAMS);
    assert.equal(out.certain.length, 0);
    assert.equal(out.manual.length, 2);
  });
});

describe("FM dışa aktarım okuma", () => {
  it("FM HTML çıktısını okur", () => {
    const html = `<table><tr><th>UID</th><th>Name</th><th>DoB</th><th>Club</th></tr>
      <tr><td>2000350338</td><td>Mohamed Salah</td><td>15/6/1992 (34 years old)</td><td>Liverpool</td></tr></table>`;
    const out = readFmPeople(html, null);
    assert.deepEqual(out, { ok: true, data: [{ uid: "2000350338", name: "Mohamed Salah", dob: "1992-06-15", club: "Liverpool" }] });
  });

  it("FM metin (|) çıktısını okur ve zorunlu sütunu denetler", () => {
    const text = "| UID | Name | Nation |\n| ---- | ---- | ---- |\n| 1000 | Liverpool | England |";
    assert.deepEqual(readFmClubs(text), { ok: true, data: [{ uid: "1000", name: "Liverpool", shortName: null, nation: "England" }] });
    assert.equal(readFmClubs("UID,Name\n1,Liverpool").ok, false);
  });
});
