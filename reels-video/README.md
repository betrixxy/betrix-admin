# reels-video

checkmatch reels video prototipi (Remotion). Next uygulamasından ayrı pakettir: kendi `package.json`'ı vardır, Docker imajına ve kök tip denetimine girmez.

- **Girdi:** tek JSON, `ReelScript` (`src/schema.ts`). Senaryo motoru bunu üretir, render bunu tüketir.
- **Sahne havuzu:** `src/story/pool.ts`. 16 sahne; verisi eksik sahne kendini kapatır ve nedenini döner. Hikâye açısı havuzdan 12–14 sahne seçer (60–75 sn).
- **Örnekler:** `src/samples` iki kurgusal maç. Gerçek oyuncu fotoğrafı ve gerçek takım yok; siluet ve armalar yer tutucudur. Modelin karnesi dahil bütün sayılar uydurmadır.
- **Servis ihtiyaçları:** `docs/contract-v1.1-ihtiyac.md`.
- **Çıktı:** repoya yazılmaz, `test-photos/reels-video/v2`.

```sh
npm install
npm run studio       # tarayıcıda önizleme
npm test
npm run stills       # 16 sahne, 4×4 kontak sayfası, tipografi testi, yerleşim denetimi
npm run render       # hikâye MP4'leri; ağır iş, maç penceresinde çalıştırılmaz
```

## Yerleşim denetimi

`npm run stills` her sahneyi render ederken gerçek kutuları ölçer (`src/lib/dom-audit.ts`) ve sorun varsa 1 ile çıkar: yüze binen öğe (fotoğraf metadata'sındaki yüz kutusuna göre), güvenli alan dışına taşma, karttan taşan metin, çakışan metin, 26 px altı yazı, mono fontta harf. Fotoğraflı sahnede yüz kutusu ölçülemezse denetim boş geçmiş sayılır ve hata verir. Sonuç `denetim.json`.

Bu denetim tek karede çalışır. Tasarım kararı ve hareket için kareler ve video gözle incelenir.

## Lisanslar

- **Fontlar (SIL Open Font License 1.1, ticari kullanıma açık, lisanslar `public/fonts/OFL-*.txt`):** Barlow Condensed (başlık, büyük rakam, takım adı), JetBrains Mono (yalnız rakamlar: skor, tarih, istatistik değeri), Geist (cümleler ve kelime etiketleri).
- **Remotion:** bireyler ve en fazla 3 çalışanlı şirketler için ücretsiz; daha büyük şirket lisans alır. Ayrıntı `node_modules/remotion/LICENSE.md`. Remotion 5.0 ile lisans değişecek, yükseltmeden önce okunmalı.
