# betrix-studio — CheckMatch.net AI İçerik Stüdyosu

CheckMatch.net için betrix.pro tarafından geliştirilen, **yarı otomatik** sosyal medya içerik stüdyosu.

- Gerçek fikstür ve istatistik verisinden (API-Football, Sportmonks, CheckMatch Mac sunucusu) marka tutarlı maç kartları üretir: Maç Günü, Muhtemel 11, Market Analizi, Puan Durumu, Haftanın Fikstürü.
- Görseller Fal.ai (oyuncu kesimi, stadyum arka planı, upscale) ve programatik Satori/SVG tipografi katmanıyla oluşur. Gönderi metni şablondan ya da Claude ile üretilir.
- Her içerik **taslak** olarak doğar. Admin panelde inceler, onaylar ve Yayın Merkezi'nden Instagram veya X'e paylaşır. Zamanlayıcı ya da otomatik yayın yoktur (bkz. `CLAUDE.md` §1.10).
- Ayrıca içerik takvimi, medya kütüphanesi, sosyal hesap bağlama (OAuth), etkileşim paneli ve checkmatch.net trafik izleme (`POST /api/track`) içerir.

Teknoloji: Next.js 16 (App Router) · React 19 · TypeScript (strict) · PostgreSQL 16 + Prisma 7 · Tailwind 4 + Shadcn · sharp · Fal.ai · Anthropic SDK.
Mimari kurallar ve kurucu kararları için bağlayıcı belge: **[`CLAUDE.md`](./CLAUDE.md)**.

## Yerel kurulum

Gereksinimler: Node.js 24, Docker.

```bash
npm ci
docker compose up -d                      # yerel PostgreSQL (127.0.0.1:5432, betrix/betrix)
```

`.env` / `.env.local` dosyalarını oluşturun. Zorunlu değişkenler `DATABASE_URL` (`postgresql://…`) ve `JWT_SECRET`. Admin seed'i için `ADMIN_EMAIL` ve `ADMIN_PASSWORD` gerekir. API anahtarları (`API_FOOTBALL_KEY`, `FAL_KEY`, `ANTHROPIC_API_KEY`, …) isteğe bağlıdır; eksik olan özellik kilitlenir. Tüm liste `src/lib/env.ts` ve `.env.production.example` içinde.

```bash
npx prisma generate --config prisma7.config.ts
npx prisma migrate deploy --config prisma7.config.ts
npm run db:seed                           # tek admin hesabı
npm run dev                               # http://localhost:3000 → /login
```

Geliştirmede `SOCIAL_USE_MOCKS` tanımsızsa `true` kabul edilir. Bu modda OAuth ve metrikler sahte veriyle çalışır, paylaşım simüle edilir.

## Üretim

Mevcut durumda prod yığını bu Windows PC'de çalışıyor; hedef ileride Mac M4 sunucusuna taşımak. Yığın şu servislerden oluşur: `postgres` + `migrate` + `app` + `caddy` + `cloudflared`. Dışarıya tek giriş Cloudflare Tunnel'dır; hiçbir port host'a açılmaz. Sırlar `.env.production` dosyasında tutulur (şablon: `.env.production.example`).

```bash
# Deploy: önce build, sonra up -d (çalışan yığını `down` ile durdurmayın)
docker compose -f docker-compose.prod.yml --env-file .env.production build
docker compose -f docker-compose.prod.yml --env-file .env.production up -d

# İlk kurulumda bir kez — admin hesabı
docker compose -f docker-compose.prod.yml --env-file .env.production run --rm migrate npx prisma db seed --config prisma7.config.ts

# Loglar
docker compose -f docker-compose.prod.yml --env-file .env.production logs -f app
```

`migrate` servisi bekleyen migration'ları uygular. `app` ancak bu adım başarıyla bitince kalkar, `caddy` de `app` sağlıklı olunca.

## Testler

| Komut | Ne yapar |
|---|---|
| `npm run test:unit` | `tests/unit/*.test.ts`: node:test + tsx ile saf hesap/eşleme fonksiyonlarının birim testleri |
| `npm run test:visual` | Maç Günü kartı: 3 şablon × 4 format × 3 senaryo, Satori ile çizilip `tests/visual/__baseline__/` ile PNG piksel farkı karşılaştırılır (Fal.ai'ye gidilmez) |
| `npm run test:visual:update` | Baseline'ı yeniden yazar. Yalnızca tasarım değişikliği onaylandığında kullanılır |
| `npx tsc --noEmit` | Tip kontrolü |
| `npm run lint` | ESLint |

Veritabanı katmanı, Server Action'lar ve dış API istemcileri (OAuth, Instagram/X yayını) için otomatik test yoktur.

## Araçlar

- `scripts/build-media-server.ts`: FM26 logo/yüz paketlerini API-Football kimlikleriyle eşleyen tek seferlik CLI.
  ```bash
  npx tsx --env-file=.env --env-file=.env.local scripts/build-media-server.ts \
    --source <FM grafik klasörü> --target <medya havuzu klasörü> \
    --fm-people <fm_oyuncular.html> --fm-clubs <fm_kulupler.html> [--dry-run] [--fresh]
  ```
