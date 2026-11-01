# reels-video

checkmatch reels video prototipi (Remotion). Next uygulamasından ayrı pakettir: kendi `package.json`'ı vardır, Docker imajına ve kök tip denetimine girmez.

- **Girdi:** tek JSON, `ReelScript` (`src/schema.ts`). Senaryo motoru bunu üretir, render bunu tüketir.
- **Örnekler:** `src/samples` iki kurgusal maç. Gerçek oyuncu fotoğrafı ve gerçek takım yok; siluet ve armalar yer tutucudur.
- **Çıktı:** repoya yazılmaz, `test-photos/reels-video`.

```sh
npm install
npm run studio       # tarayıcıda önizleme
npm test
npm run stills       # sahne kareleri + kontak sayfası
npm run render       # iki MP4; ağır iş, maç penceresinde çalıştırılmaz
```

## Lisanslar

- **Font:** Geist, SIL Open Font License 1.1 (`public/fonts/OFL-Geist.txt`). Ticari kullanıma açık.
- **Remotion:** bireyler ve en fazla 3 çalışanlı şirketler için ücretsiz; daha büyük şirket lisans alır. Ayrıntı `node_modules/remotion/LICENSE.md`. Remotion 5.0 ile lisans değişecek, yükseltmeden önce okunmalı.
