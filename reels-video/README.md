# reels-video

checkmatch reels video prototipi (Remotion). Next uygulamasından ayrı pakettir: kendi `package.json`'ı vardır, Docker imajına ve kök tip denetimine girmez.

- **Konsept:** futbol analizi. Yalnız veri göstermez, maçı okur ve yorumlar: "İki takımın da gol bulma olasılığı %62, çünkü …". Market, bahis dili olmadan bir soruya dönüşür. Soru sahneleri: başlık + ana rakam (≥ 160 px) + 2–4 destek (≥ 48 px) + "Neden?". HUD rozeti `MONTE CARLO · {N} SİMÜLASYON` yalnız simülasyon rakamı olan sahnede; API-Football verisi bu etiketle gösterilmez.
- **Girdi:** tek JSON, `ReelScript` (`src/schema.ts`). Senaryo motoru bunu üretir, render bunu tüketir.
- **Sahne havuzu:** `src/story/pool.ts`, `questions.ts`, `analysis.ts`. Verisi eksik ya da şüpheli sahne kendini kapatır ve nedenini döner (`market-checks.ts`). Akış `story.ts`: Kapak → Maçın hikâyesi → Monte Carlo → Form → Eksikler → Takım ×2 → Dakikalar → Gollü mü → İki takım gol → İlk gol → Anahtar → Sürpriz → Senaryo → Düello → Rakibine karşı → Anket. 75–100 sn; hikâye açısı yedekten sahne ekler. `storyProblems` yayın engellerini döner.
- **Yorum:** `story/claims.ts`. Şablonda rakam yazılamaz; her rakam `MatchData`'dan anahtarla okunur, her cümle kaynak anahtarlarını taşır. LLM yalnız yuvalı şablonu doğallaştırır (`src/lib/services/anthropic/reel-commentary.ts`, denetim `src/lib/reels/commentary.ts`), rakam ve yeni iddia ekleyemez. Analist notu panelden gelir, "Maçın anahtarı" ve "checkmatch senaryosu" kartlarına girer.
- **Futbol okuması:** API-Football, dondurmada `ReelSnapshot.context` (`src/lib/reels/context-*.ts`, şekil `story/match-context.ts`).
- **Oyuncular:** `story/players.ts`, `story/squad.ts`, `story/name-guard.ts`. Her oyuncu kimlikle güncel kadroda doğrulanır, önbellek en fazla 7 gün. Senaryodaki her özel ad snapshot + kadro verisinde olmalı.
- **Tasarım yönleri:** `src/design/`. A Yayın, B Dergi, C Veri laboratuvarı, D Maç günü posteri, E Taktik tahtası. Ana vurgu her yönde checkmatch yeşili (`#2EA537`); koyu zeminde yazı olarak açık tonu (`#4CC456`), çünkü marka yeşili yazıda 4,5 kontrastı tutturmuyor. S02–S05, S07, S11, S14–S16 akışta yok, eski tasarımda duruyor.
- **Örnekler:** `src/samples` iki kurgusal maç, futbol okuması dahil bütün sayılar uydurmadır.
- **Araştırma:** `docs/arastirma-tasarim.md`.
- **Servis ihtiyaçları:** `docs/contract-v1.2-ihtiyac.md`.
- **Çıktı:** repoya yazılmaz, `test-photos/reels-video/`.

```sh
npm install
npm run studio       # tarayıcıda önizleme
npm test
npm run board        # tasarım panosu: 5 yön × 6 kart (Monte Carlo 3 evre), karşılaştırma, denetim
npm run flow         # aktif temada tam akış: tek kareler, kontak sayfası, okunurluk denetimi; --mc: Monte Carlo MP4 (ağır iş)
npm run stills       # bütün sahneler, kontak sayfası, tipografi testi, yerleşim denetimi
npm run render       # hikâye MP4'leri; ağır iş, maç penceresinde çalıştırılmaz
```

Gerçek oyuncu kesimiyle yerel pano: `npm run board -- --cutouts=../storage/generated`. Kesimler `public/_local`'e kopyalanır, git'e girmez. Telifli görsel ve ondan türeyen çıktı repoya girmez.

## Denetim

`npm run board` her kareyi render ederken gerçek kutuları ölçer (`src/lib/dom-audit.ts`) ve sorun varsa 1 ile çıkar: yüze binen öğe, Instagram/TikTok/Shorts güvenli alan kesişimi (üst 252, alt 420, sol 90, sağ 200 px; platformların resmî değeri yok, telefonda doğrulanmalı), taşan ya da çakışan metin, 26 px altı yazı, şablon alt sınırı, **metin arkası kontrast ≥ 4,5**.

Kontrast, metni gizlenmiş ikinci render'dan piksel okunarak ölçülür. Rakamlar tabular değilse sabit hücreye girer (`Figures`); denetim en geniş rakamın sığdığını ölçer. Bu denetim tek karede çalışır. Tasarım kararı ve hareket için kareler ve video gözle incelenir.

## Lisanslar

- **Fontlar (SIL Open Font License 1.1, ticari kullanıma açık, lisanslar `public/fonts/OFL-*.txt`):** Anton, Saira Extra Condensed (A); DM Serif Display, Geist (B); Unbounded, JetBrains Mono (C); Archivo Black, Barlow Condensed (D); Caveat Brush, Kalam (E). Türkçe glifler dosyadan denetlenir.
- **Zeminler:** `public/backgrounds` tamamen kodla üretilir (`scripts/make-backgrounds.ts`), fotoğraf değildir, kurgusaldır.
- **Remotion:** bireyler ve en fazla 3 çalışanlı şirketler için ücretsiz; daha büyük şirket lisans alır. Ayrıntı `node_modules/remotion/LICENSE.md`. Remotion 5.0 ile lisans değişecek, yükseltmeden önce okunmalı.
