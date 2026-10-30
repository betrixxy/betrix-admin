/**
 * Sabit Sportmonks kişi yanıtları (`/squads/teams/{id}`, `/coaches/search/{ad}` ŞEKLİNDE, bkz.
 * `lib/services/sportmonks/people-mappers.ts`) — görsel testlerin kişi adları bunlardan, üretimdeki kart adı
 * kuralıyla (`cardPersonName` + `card-name-forms.ts`) türetilir; ad kuralı bozulursa görsel test de kırılır.
 * Kurgusal takımların adları uydurmadır; gerçek oyuncuların kayıtları (yaygın ad, uyruk) sade hâliyle.
 * Bilerek bırakılan durumlar: kadroda olmayan oyuncu (API yolu), yaygın adı olmayan kayıt (yalnızca harf
 * geri yükleme), tireli soyad, NFD'de ayrışmayan harf (ø, Ł, ß).
 */

/** [forma, yaygın ad (display_name) | null, resmi ilk ad, resmi soyad, uyruk] */
type Row = [jersey: number | null, displayName: string | null, firstname: string, lastname: string, nationality: string];

const person = ([, displayName, firstname, lastname, nationality]: Row) => ({ display_name: displayName, common_name: null, firstname, lastname, nationality: { name: nationality } });
const squad = (rows: Row[]) => ({ data: rows.map((row) => ({ jersey_number: row[0], player: person(row) })) });
const coaches = (rows: Row[]) => ({ data: rows.map((row) => ({ ...person(row), teams: [] })) });

/** Muhtemel 11 · Türk takımı: API ASCII ("C. Gucluoglu") → Türkçe harfli kısa ad. Eğilmez'in yaygın adı yok. */
export const SM_SQUAD_KURGU = squad([
  [1, "Çağan Güçlüoğlu", "Çağan", "Güçlüoğlu", "Turkey"],
  [2, "İsmail Şenyürek", "İsmail", "Şenyürek", "Turkey"],
  [4, "Emre Demir", "Emre", "Demir", "Turkey"],
  [5, "Ömer Ağaoğlu", "Ömer", "Ağaoğlu", "Turkey"],
  [3, "Kaan Işıklı", "Kaan", "Işıklı", "Turkey"],
  [8, "Serkan Kılıçarslan", "Serkan", "Kılıçarslan", "Turkey"],
  [6, "Berk Gümüştekin", "Berk", "Gümüştekin", "Turkey"],
  [7, "Tolga Yiğitbaşı", "Tolga", "Yiğitbaşı", "Turkey"],
  [10, "Hakan Çiftçi", "Hakan", "Çiftçi", "Turkey"],
  [11, "Ümit İnceoğlu", "Ümit", "İnceoğlu", "Turkey"],
  [9, null, "Doğukan", "Eğilmez", "Turkey"],
]);
export const SM_COACH_KURGU = coaches([[null, "İlhan Şıkışık", "İlhan", "Şıkışık", "Turkey"]]);

/** Muhtemel 11 · yabancı takım: ø/ñ/ć harfleri geri yüklenir; Ricci kadroda yok (API adı kalır). */
export const SM_SQUAD_MILANO = squad([
  [1, "Jakub Wójcik", "Jakub", "Wójcik", "Poland"],
  [2, "Lars Jørgensen", "Lars", "Jørgensen", "Denmark"],
  [4, "Nnamdi Ijeoma", "Nnamdi", "Ijeoma", "Nigeria"],
  [5, "Rafael Silva", "Rafael", "Silva", "Portugal"],
  [3, "Marko Nikolić", "Marko", "Nikolić", "Serbia"],
  [6, "Felix Müller", "Felix", "Müller", "Germany"],
  [8, "Pablo Ibáñez", "Pablo", "Ibáñez", "Spain"],
  [10, "Tobias Kristiansen", "Tobias", "Kristiansen", "Norway"],
  [7, "Vasilis Dimitriou", "Vasilis", "Dimitriou", "Greece"],
  [11, "Andile Mbeki", "Andile", "Mbeki", "South Africa"],
]);
export const SM_COACH_MILANO = coaches([[null, "Dimitri Ivanović", "Dimitri", "Ivanović", "Serbia"]]);

/** Muhtemel 11 · uzun adlar: tireli soyadlar, "de la"/"van der" ekleri; Wan-Bissaka-Longfellow kadroda yok. */
export const SM_SQUAD_GLADBACH = squad([
  [99, "Konstantinos Papadopoulos-Alexandridis", "Konstantinos", "Papadopoulos-Alexandridis", "Greece"],
  [22, "Mehmet Ali Karaosmanoğlu", "Mehmet Ali", "Karaosmanoğlu", "Turkey"],
  [15, "Alejandro Hernández de la Fuente", "Alejandro", "Hernández de la Fuente", "Spain"],
  [13, null, "Wolfgang", "Schweinsteiger-Hummels", "Germany"],
  [18, "Burak Abdurrahmanoğlu", "Burak", "Abdurrahmanoğlu", "Turkey"],
  [17, "Callum Oxlade-Chamberlainson", "Callum", "Oxlade-Chamberlainson", "England"],
  [14, "Dewald van der Westhuizen", "Dewald", "van der Westhuizen", "South Africa"],
  [88, "Emre Kılıçdaroğlugil", "Emre", "Kılıçdaroğlugil", "Turkey"],
  [77, "Fodé Diakhaby-Koulibaly", "Fodé", "Diakhaby-Koulibaly", "France"],
  [19, "Gaël Aubameyang-Ondoua", "Gaël", "Aubameyang-Ondoua", "Gabon"],
  [10, "Alassane Pléa", "Alassane", "Pléa", "France"],
]);
export const SM_COACH_GLADBACH = coaches([[null, "Konstantin Alexandropoulos-Weißmann", "Konstantin", "Alexandropoulos-Weißmann", "Germany"]]);

/** Oyuncu Karşılaştırması · sol oyuncu. */
export const SM_SQUAD_FENERBAHCE = squad([[7, "Kerem Aktürkoğlu", "Kerem", "Aktürkoğlu", "Turkey"]]);

/** Set kartları · golcüler (gerçek maçlar). */
// KK golü golün yazıldığı takıma (GS) düşer ama golü atan rakipten: ad önce Gençlerbirliği kadrosunda aranır.
export const SM_SQUAD_GALATASARAY = squad([[1, "Uğurcan Çakır", "Uğurcan", "Çakır", "Turkey"]]);
export const SM_SQUAD_GENCLERBIRLIGI = squad([[1, "İrfan Can Eğribayat", "İrfan Can", "Eğribayat", "Turkey"]]);
export const SM_SQUAD_BESIKTAS = squad([
  [10, "Orkun Kökçü", "Orkun", "Kökçü", "Turkey"],
  [2, "Amir Murillo", "Amir", "Murillo", "Panama"],
  [9, "Oh Hyeon-Gyu", "Hyeon-Gyu", "Oh", "Korea Republic"],
]);
export const SM_SQUAD_HOFFENHEIM = squad([
  [11, "Fisnik Asllani", "Fisnik", "Asllani", "Kosovo"],
  [15, "Koki Machida", "Koki", "Machida", "Japan"],
]);

/** Oyuncu İstatistikleri · Milan–Bologna. Mbangula kadroda yok (API soyadı); Cissè'nin yaygın adı yok. */
export const SM_SQUAD_MILAN = squad([
  [23, "Fikayo Tomori", "Oluwafikayomi", "Tomori", "England"],
  [32, null, "Alphadjo", "Cissè", "Italy"],
]);
export const SM_SQUAD_BOLOGNA = squad([
  [1, "Łukasz Skorupski", "Łukasz", "Skorupski", "Poland"],
  [21, "Jens Odgaard", "Jens Peter", "Odgaard", "Denmark"],
  [20, "Nadir Zortea", "Nadir", "Zortea", "Italy"],
  // Kurgusal uzun ve Türkçe karakterli adlar (veri gerçek oyuncu satırından, bkz. player-stats testi).
  [19, "Mohamed-Ali Abdelrahman Kouyaté-Diakhaby", "Mohamed-Ali Abdelrahman", "Kouyaté-Diakhaby", "Mali"],
  [8, "İrfan Can Eğribayat Çağlayan", "İrfan Can", "Eğribayat Çağlayan", "Turkey"],
]);
