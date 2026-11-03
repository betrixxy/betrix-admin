# reels-video

checkmatch reels video prototipi (Remotion). Next uygulamasından ayrı pakettir: kendi `package.json`'ı vardır, Docker imajına ve kök tip denetimine girmez.

- **Konsept:** web sitesindeki market, sosyal medyada bahis dili olmadan bir soruya dönüşür; soru dikkat çeker, ekranı rakamlar doldurur. Her veri sahnesi aynı şablon: soru başlığı (2 satır, 2. satır vurgu) + ana rakam (≥ 160 px) + 2–4 destek istatistiği (≥ 48 px) + HUD'da `MONTE CARLO · {N} SİMÜLASYON`.
- **Girdi:** tek JSON, `ReelScript` (`src/schema.ts`). Senaryo motoru bunu üretir, render bunu tüketir.
- **Sahne havuzu:** `src/story/pool.ts` + `src/story/questions.ts`. Verisi eksik ya da şüpheli sahne kendini kapatır ve nedenini döner (`market-checks.ts`). Hikâye 12–16 sahne, 60–90 sn; kanca → "Nasıl hesapladık?" → veri; Düello her videoda. `storyProblems` yayın engellerini döner.
- **Oyuncular:** `story/players.ts`, `story/squad.ts`, `story/name-guard.ts`. Her oyuncu kimlikle güncel kadroda doğrulanır, önbellek en fazla 7 gün. Senaryodaki her özel ad snapshot + kadro verisinde olmalı.
- **Tasarım yönleri:** `src/design/`. A Yayın, B Dergi, C Veri laboratuvarı. Yön seçilene kadar S02–S05, S07, S11, S14–S16 eski tasarımda kalır.
- **Örnekler:** `src/samples` iki kurgusal maç. Modelin karnesi ve "Nasıl hesapladık?" listesi dahil bütün sayılar uydurmadır; gerçek akışta bu ikisi kapalıdır.
- **Servis ihtiyaçları:** `docs/contract-v1.2-ihtiyac.md`.
- **Çıktı:** repoya yazılmaz, `test-photos/reels-video/`.

```sh
npm install
npm run studio       # tarayıcıda önizleme
npm test
npm run board        # tasarım panosu: yön başına 5 sahne, karşılaştırma, denetim
npm run stills       # bütün sahneler, kontak sayfası, tipografi testi, yerleşim denetimi
npm run render       # hikâye MP4'leri; ağır iş, maç penceresinde çalıştırılmaz
```

Gerçek oyuncu kesimiyle yerel pano: `npm run board -- --cutouts=../storage/generated`. Kesimler `public/_local`'e kopyalanır, git'e girmez. Telifli görsel ve ondan türeyen çıktı repoya girmez.

## Denetim

`npm run board` her kareyi render ederken gerçek kutuları ölçer (`src/lib/dom-audit.ts`) ve sorun varsa 1 ile çıkar: yüze binen öğe, Instagram/TikTok/Shorts güvenli alan kesişimi (üst 252, alt 420, sol 90, sağ 200 px; platformların resmî değeri yok, telefonda doğrulanmalı), taşan ya da çakışan metin, 26 px altı yazı, şablon alt sınırı, **metin arkası kontrast ≥ 4,5**.

Kontrast, metni gizlenmiş ikinci render'dan piksel okunarak ölçülür. Rakamlar tabular değilse sabit hücreye girer (`Figures`); denetim en geniş rakamın sığdığını ölçer. Bu denetim tek karede çalışır. Tasarım kararı ve hareket için kareler ve video gözle incelenir.

## Lisanslar

- **Fontlar (SIL Open Font License 1.1, ticari kullanıma açık, lisanslar `public/fonts/OFL-*.txt`):** Anton, Saira Extra Condensed (A); DM Serif Display, Geist (B); Unbounded, JetBrains Mono (C); Barlow Condensed (eski sahneler). Türkçe glifler dosyadan denetlenir.
- **Zeminler:** `public/backgrounds` tamamen kodla üretilir (`scripts/make-backgrounds.ts`), fotoğraf değildir, kurgusaldır.
- **Remotion:** bireyler ve en fazla 3 çalışanlı şirketler için ücretsiz; daha büyük şirket lisans alır. Ayrıntı `node_modules/remotion/LICENSE.md`. Remotion 5.0 ile lisans değişecek, yükseltmeden önce okunmalı.
