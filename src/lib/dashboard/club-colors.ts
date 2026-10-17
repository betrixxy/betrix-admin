/**
 * Kulüp renk tablosu — elle tutulur, kartlardaki takım renginin BİRİNCİL kaynağı (bkz. CLAUDE.md
 * 1.10 Maç Sonucu / Maç İstatistikleri). Öncelik: bu tablo > API-Football diziliş forma rengi >
 * nötr. Diziliş rengi o maçın formasıdır (deplasmanda sarı giyen Hoffenheim "sarı" görünürdü);
 * kulübün kimlik rengi bu tablodadır.
 *
 * Anahtar API-Football takım kimliğidir — kimlikler `/teams?league=<id>&season=2026` yanıtından
 * alınmıştır (Süper Lig 203, UCL 2, UEL 3, UECL 848; 2026-10-17). Tabloda olmayan takım için
 * diziliş rengi kullanılır. `secondary`: birincil renk rakiple çakışırsa ya da koyu zeminde
 * griye açılan renksiz bir renkse (siyah) kullanılır (bkz. `match-stats-theme.ts`).
 */

export interface ClubColors {
  /** Kontrol için kulüp adı (tabloda arama yapılmaz). */
  name: string;
  primary: string;
  secondary: string;
}

const club = (name: string, primary: string, secondary: string): ClubColors => ({ name, primary, secondary });

export const CLUB_COLORS: Readonly<Record<number, ClubColors>> = {
  // ---- Süper Lig 2026-27 (18 takım) ----
  549: club("Beşiktaş", "#FFFFFF", "#000000"),
  564: club("Başakşehir", "#E2672A", "#163962"),
  607: club("Konyaspor", "#00843D", "#FFFFFF"),
  611: club("Fenerbahçe", "#163962", "#FFED00"),
  645: club("Galatasaray", "#A90432", "#FDB912"),
  994: club("Göztepe", "#FFD200", "#E30613"),
  996: club("Alanyaspor", "#F28C00", "#00843D"),
  997: club("Gençlerbirliği", "#E30613", "#000000"),
  998: club("Trabzonspor", "#7A1E3A", "#5AB4E5"),
  1004: club("Kasımpaşa", "#1B2D5B", "#FFFFFF"),
  1007: club("Çaykur Rizespor", "#00843D", "#0055A4"),
  1009: club("Erzurumspor", "#005CA9", "#FFFFFF"),
  3573: club("Gaziantep FK", "#E30A17", "#000000"),
  3579: club("Amed SK", "#009A44", "#E30A17"),
  3588: club("Eyüpspor", "#5B2C83", "#FFD100"),
  3603: club("Samsunspor", "#E30A17", "#FFFFFF"),
  6343: club("Çorum FK", "#D71920", "#000000"),
  7411: club("Kocaelispor", "#007A3D", "#000000"),
  // ---- Milli takım ----
  777: club("Türkiye", "#E30A17", "#FFFFFF"),

  // ---- Avrupa kupalarında Türk takımlarının sık rakipleri ----
  // İngiltere
  33: club("Manchester United", "#DA291C", "#FBE122"),
  40: club("Liverpool", "#C8102E", "#00B2A9"),
  42: club("Arsenal", "#EF0107", "#FFFFFF"),
  50: club("Manchester City", "#6CABDD", "#1C2C5B"),
  66: club("Aston Villa", "#670E36", "#95BFE5"),
  // İspanya
  529: club("Barcelona", "#A50044", "#004D98"),
  530: club("Atlético Madrid", "#CB3524", "#272E61"),
  541: club("Real Madrid", "#FFFFFF", "#FEBE10"),
  533: club("Villarreal", "#FFE667", "#005187"),
  543: club("Real Betis", "#00954C", "#FFFFFF"),
  548: club("Real Sociedad", "#0067B1", "#FFFFFF"),
  // Almanya
  157: club("Bayern München", "#DC052D", "#0066B2"),
  165: club("Borussia Dortmund", "#FDE100", "#000000"),
  167: club("Hoffenheim", "#1961B5", "#FFFFFF"),
  168: club("Bayer Leverkusen", "#E32221", "#000000"),
  172: club("VfB Stuttgart", "#E32219", "#FFFFFF"),
  173: club("RB Leipzig", "#DD0741", "#001F47"),
  160: club("SC Freiburg", "#E2001A", "#000000"),
  // İtalya
  489: club("AC Milan", "#FB090B", "#000000"),
  492: club("Napoli", "#12A0D7", "#FFFFFF"),
  496: club("Juventus", "#FFFFFF", "#000000"),
  497: club("AS Roma", "#8E1F2F", "#F0BC42"),
  499: club("Atalanta", "#1E71B8", "#000000"),
  505: club("Inter", "#0068A8", "#000000"),
  // Fransa
  79: club("Lille", "#E01E13", "#24215B"),
  80: club("Lyon", "#FFFFFF", "#14387F"),
  81: club("Marseille", "#2FAEE0", "#FFFFFF"),
  85: club("Paris Saint-Germain", "#004170", "#DA291C"),
  91: club("Monaco", "#E51B22", "#FFFFFF"),
  116: club("Lens", "#FFD400", "#E30613"),
  // Portekiz
  211: club("Benfica", "#E83030", "#FFFFFF"),
  212: club("FC Porto", "#003893", "#FFFFFF"),
  217: club("SC Braga", "#E03A3E", "#FFFFFF"),
  228: club("Sporting CP", "#008057", "#FFFFFF"),
  // Hollanda
  194: club("Ajax", "#D2122E", "#FFFFFF"),
  197: club("PSV", "#ED1C24", "#FFFFFF"),
  201: club("AZ Alkmaar", "#E30613", "#FFFFFF"),
  209: club("Feyenoord", "#E30613", "#FFFFFF"),
  415: club("Twente", "#E30613", "#FFFFFF"),
  // Belçika
  554: club("Anderlecht", "#4C2683", "#FFFFFF"),
  569: club("Club Brugge", "#0A64AD", "#000000"),
  631: club("Gent", "#005CA9", "#FFFFFF"),
  1393: club("Union Saint-Gilloise", "#F9D616", "#004B93"),
  // İskoçya
  247: club("Celtic", "#018749", "#FFFFFF"),
  257: club("Rangers", "#1B458F", "#FFFFFF"),
  // Yunanistan
  553: club("Olympiakos", "#E3061B", "#FFFFFF"),
  575: club("AEK Atina", "#FFD200", "#000000"),
  617: club("Panathinaikos", "#007A33", "#FFFFFF"),
  619: club("PAOK", "#000000", "#FFFFFF"),
  // Avusturya, İsviçre, Çekya, Macaristan, Polonya, Romanya
  571: club("Red Bull Salzburg", "#D6001C", "#FFFFFF"),
  637: club("Sturm Graz", "#000000", "#FFFFFF"),
  781: club("Rapid Wien", "#00703C", "#FFFFFF"),
  560: club("Slavia Praha", "#C8102E", "#FFFFFF"),
  628: club("Sparta Praha", "#A50034", "#FFD100"),
  567: club("Viktoria Plzeň", "#003D7C", "#C8102E"),
  651: club("Ferencváros", "#00843D", "#FFFFFF"),
  347: club("Lech Poznań", "#0050A0", "#FFFFFF"),
  559: club("FCSB", "#E30613", "#0055A4"),
  // Balkanlar, Doğu Avrupa
  598: club("Kızılyıldız", "#E30613", "#FFFFFF"),
  573: club("Partizan", "#000000", "#FFFFFF"),
  620: club("Dinamo Zagreb", "#0055A5", "#FFFFFF"),
  608: club("Hajduk Split", "#FFFFFF", "#00539F"),
  550: club("Shakhtar Donetsk", "#F47920", "#000000"),
  572: club("Dinamo Kiev", "#FFFFFF", "#004B9C"),
  556: club("Karabağ", "#000000", "#FFFFFF"),
  // İskandinavya, İsrail
  397: club("Midtjylland", "#000000", "#D3122A"),
  400: club("Kopenhag", "#FFFFFF", "#004B93"),
  327: club("Bodø/Glimt", "#FFE600", "#000000"),
  604: club("Maccabi Tel Aviv", "#FFE600", "#003399"),
};

export function clubColors(teamId: number): ClubColors | null {
  return CLUB_COLORS[teamId] ?? null;
}
