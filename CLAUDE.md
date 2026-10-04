# CLAUDE.md — betrix.pro / CheckMatch.net AI Ajans Stüdyosu

Bu dosya, bu repository içinde çalışan her yapay zeka ajanı (Claude Code dahil) için bağlayıcı mimari anayasadır. Kod yazmadan, bir komut çalıştırmadan veya bir dosya oluşturmadan önce ilgili bölüm mutlaka okunmalı ve uygulanmalıdır. Kurallarla çelişen bir istek geldiğinde, önce bu dosyadaki standart hatırlatılır, sonra kullanıcıyla netleştirilir.

---

## 0. Proje Kimliği

| Alan | Değer |
|---|---|
| Ürün sahibi | CheckMatch.net (maç tahmin/analiz platformu) |
| Yapan kuruluş | betrix.pro |
| Ürünün özü | Fikstür verisinden otomatik, çoklu formatlı, marka tutarlı sosyal medya içeriği üreten AI ajans stüdyosu |
| Birincil hedef | CheckMatch.net'e sosyal medyadan ölçülebilir, izlenebilir trafik ve dönüşüm |
| Rolün | Baş Yazılım Mimarı + Dijital Büyüme/İçerik Stratejisti — hem kod kalitesinden hem de üretilen içeriğin pazarlama etkinliğinden sorumlusun |

**Kuzey Yıldızı:** Her maç için — maç öncesi, canlı, maç sonrası — sıfır manuel müdahaleyle, marka tutarlı, platforma özel, dönüşüm izlenebilir içerik üretebilen bir sistem.

---

## 1. Proje Vizyonu ve Mimari Standartlar

### 1.1 Teknoloji Yığını (Zorunlu, Değiştirilemez)

| Katman | Teknoloji | Not |
|---|---|---|
| Frontend framework | Next.js 14+ (App Router) | `pages/` router yasak. Sadece `app/`. |
| Dil | TypeScript (strict mode) | `any` yasak, `unknown` + daraltma zorunlu. |
| Stil | Tailwind CSS | Ham CSS dosyası yalnızca render motorunda (bkz. Bölüm 3.4) istisnadır. |
| Bileşen kütüphanesi | Shadcn UI | Fork edilip `components/ui/` altında tutulur, npm bağımlılığı olarak değil kaynak kod olarak yönetilir. |
| Veritabanı / Auth | Yerel PostgreSQL (Docker) + Prisma ORM · Kendi Auth sistemimiz (bcryptjs + jose JWT) | **Kalıcı mimari karar, bkz. 1.6.** Üçüncü parti bir BaaS (Supabase vb.) kullanılmaz ve kullanılması planlanmamaktadır. |
| Görsel üretim motoru | Fal.ai (birefnet, flux ailesi) | Bkz. Bölüm 3. |
| Spor verisi | Sportmonks (birincil), API-Football (ikincil/doğrulama) | Bkz. Bölüm 2. |
| Görsel doğrulama | Playwright | Bkz. Bölüm 5.3. |
| Grafikler | Recharts | Yalnızca istemci bileşenlerinde (`"use client"`); veri sunucuda hazırlanıp serileştirilebilir dizi olarak geçirilir. |
| Sunucu tarafı görsel işleme | sharp | Yüklenen görselin gerçek biçim/boyut doğrulaması ve render şablonuna gömülecek küçültme. |

### 1.2 Dizin Mimarisi

Proje `create-next-app --src-dir` ile kurulmuştur; uygulama kaynak kodu `src/` altında yaşar. `prisma/` ve `tests/` (ilgili CLI/koşucu konvansiyonu gereği) proje kökünde kalır. Yerel PostgreSQL, `docker-compose.yml` (proje kökü) ile ayağa kaldırılır — bkz. 1.6.

```
betrix-studio/
├─ src/
│  ├─ app/                        # Next.js App Router — sadece route, layout, page
│  │  ├─ dashboard/                # Ajans paneli: sol menülü layout + modüller (bkz. 1.8)
│  │  │  ├─ matches/               # Maç Merkezi: gerçek fikstür + içerik türü → "Stüdyoya Git" (bkz. 1.10)
│  │  │  ├─ drafts/[id]/           # Taslak inceleme: önizle / düzenle / onayla (bkz. 1.10)
│  │  │  ├─ library/               # Medya/referans kütüphanesi (bkz. 1.11)
│  │  │  ├─ (finance/)             # Planlanan: gelir/gider ve aylık bilanço (bkz. 1.12)
│  │  │  ├─ calendar/              # İçerik Üretim Takvimi (SocialPost)
│  │  │  ├─ analytics/             # Etkileşim ve Reklam Paneli (PostAnalytics)
│  │  │  ├─ studio/                # AI İçerik Stüdyosu (AiContent)
│  │  │  └─ traffic/               # Web Trafik Analizi (TrafficLog)
│  │  ├─ studio/                   # AI görsel/render stüdyosu arayüzü (bkz. Bölüm 3)
│  │  ├─ calendar/                 # Fikstür tabanlı içerik takvimi (bkz. Bölüm 4.2)
│  │  ├─ login/                    # Admin giriş ekranı (bkz. 1.6)
│  │  └─ api/                      # Route handlers — YALNIZCA ince orkestrasyon, iş mantığı yok (şu an: files/ — yerel depolama servisi, track/ — checkmatch.net trafik ingest'i, auth/[platform]/{connect,callback} — sosyal hesap OAuth'u, bkz. 4.4, og/match-day — DEVRE DIŞI (410); Maç Günü kartı artık `/dashboard/studio/match-day` → `lib/dashboard/match-day-engine.ts` (Fal.ai birefnet + flux + image-to-image harmanlama, şablonlar `templates/match-day/{premium-broadcast,data-driven,editorial-portrait}.tsx` × formatlar `lib/dashboard/match-day-formats.ts` (4:5, 1:1, 9:16 güvenli alanlı, 16:9); yazı konumu ve oyuncu yerleşimi TEK kaynaktan: `templates/match-day/geometry.ts`; AI sanat yönetimi `lib/services/fal/match-day-prompts.ts` (gerçekçi spor fotoğrafçılığı, hex yerine renk adı, istenmeyen kavram anılmaz); maliyet: kesim/arka plan önbelleği `lib/dashboard/match-day-cache.ts`, düşük çözünürlüklü arka plan, Ekonomik mod (harmanlamasız), Data Driven programatik zemin; fontlar `public/fonts/` (Geist + Anton + DM Serif Display, OFL), marka logoları `public/brand/`))
│  ├─ components/
│  │  ├─ ui/                       # Shadcn UI bileşenleri (fork edilmiş kaynak)
│  │  └─ features/                 # Özellik bazlı bileşenler
│  │     ├─ dashboard/
│  │     ├─ studio/
│  │     ├─ calendar/
│  │     └─ auth/                  # Login formu vb. (bkz. 1.6)
│  ├─ lib/
│  │  ├─ services/                 # Dış API soyutlama katmanı (bkz. 1.4)
│  │  │  ├─ sportmonks/
│  │  │  ├─ api-football/
│  │  │  ├─ checkmatch-core/       # Mac sunucusu köprüsü (VIP token'lı service-to-service)
│  │  │  ├─ fal/
│  │  │  ├─ meta/
│  │  │  ├─ tiktok/
│  │  │  ├─ youtube/
│  │  │  └─ x/
│  │  ├─ dashboard/                # Dashboard modüllerinin sorguları, saf istatistik fonksiyonları, depolama ve render yardımcıları (bkz. 1.8)
│  │  ├─ auth/                     # password.ts, session.ts, credentials.ts, require-session.ts (bkz. 1.6)
│  │  ├─ prisma.ts                 # PrismaClient tekil (singleton) — bkz. 1.6
│  │  ├─ env.ts                    # zod ile doğrulanmış merkezi env erişimi
│  │  └─ utils.ts                  # Shadcn `cn()` yardımcı fonksiyonu + genel yardımcılar
│  ├─ generated/prisma/            # `prisma generate` çıktısı, elle düzenlenmez, gitignore'da (bkz. 1.6)
│  ├─ types/                       # Paylaşılan, katmanlar-arası TypeScript tipleri
│  ├─ hooks/                       # Client-side React hook'ları
│  ├─ proxy.ts                     # Route koruması — Next.js 16 `proxy` konvansiyonu (eski adı `middleware`)
│  └─ skills/
│     └─ render-engine/
│        └─ templates/             # Format bazlı render şablonları (bkz. 3.3)
├─ docker-compose.yml              # Yerel PostgreSQL servisi (bkz. 1.6)
├─ docker-compose.prod.yml         # Üretim yığını: postgres + migrate + app + caddy (bkz. 1.9)
├─ Dockerfile                      # Çok aşamalı standalone imaj — runner/migrator hedefleri (bkz. 1.9)
├─ Caddyfile                       # Ters vekil + otomatik HTTPS + güvenlik başlıkları (bkz. 1.9)
├─ .env.production.example         # Üretim env şablonu (gerçek `.env.production` gitignore'da)
├─ storage/                        # uploads/ generated/ renders/ library/ — gitignore'da, yalnızca /api/files ile servis edilir (bkz. 1.6, 1.11)
├─ prisma/
│  ├─ schema.prisma                # Veritabanı modelleri (ContentPlan, AdminUser) — bkz. 1.6
│  ├─ migrations/                  # Sıralı, geri dönüşü belgelenmiş Prisma migration'ları
│  └─ seed.ts                      # Tek admin hesabını oluşturur (`npx prisma db seed`)
├─ tests/
│  ├─ fixtures/                    # Mock Sportmonks/API-Football/Fal.ai/Meta/TikTok/YouTube/X yanıtları
│  └─ visual/                      # Playwright görsel regresyon testleri
└─ CLAUDE.md
```

**Kural:** Bu yapının dışında yeni bir üst düzey dizin açmadan önce gerekçe kullanıcıya sunulur. `app/dashboard`, `app/studio`, `app/calendar` şimdilik düz klasörlerdir; ileride betrix.pro tanıtım yüzeyi eklenirse `(marketing)` route group'u ayrıca açılır.

**Not:** `prisma init` çalıştırıldığında proje köküne `.claude/skills/`, `.windsurf/skills/`, `.agents/skills/` (Prisma CLI/Client referans dokümanları, araç tarafından otomatik kurulur) ve `prisma7.config.ts` eklendi. Bunlar uygulama kodu değil, ajan/araç tooling'i içindir; yukarıdaki kuralın istisnasıdır ve elle düzenlenmez.

### 1.3 TypeScript — Katı Tip Kuralları

1. `tsconfig.json` içinde `"strict": true`, `"noUncheckedIndexedAccess": true`, `"exactOptionalPropertyTypes": true` zorunludur.
2. `any` kullanımı yasaktır. Dış kaynaktan (API, kullanıcı girdisi, dosya) gelen her veri `unknown` olarak karşılanır, zod şeması ile doğrulanıp daraltılır.
3. Dış API yanıtları için **ham tip** (`SportmonksFixtureRaw`) ile **kanonik iç tip** (`Fixture`) ayrılır. Servis katmanı ham veriyi kanonik tipe dönüştürür; UI ve iş mantığı asla ham tipi görmez.
4. Hata durumları union tip ile modellenir, exception fırlatarak akış kontrolü yapılmaz:
   ```ts
   type Result<T, E = AppError> =
     | { ok: true; data: T }
     | { ok: false; error: E };
   ```
5. Discriminated union'lar durum makineleri için zorunludur (örnek: içerik takvimi durumları, bkz. Bölüm 4.2).
6. Hiçbir `interface`/`type` `export` edilmeden `types/` dışında tekrar tanımlanmaz — tek kaynak ilkesi.

### 1.4 API Servis Katmanı Soyutlaması

**Kural:** Hiçbir bileşen, route handler veya server action; `fetch`'i veya Fal.ai SDK'sını doğrudan çağırmaz. Her dış entegrasyon `lib/services/<sağlayıcı>/` altında şu üçlüyle temsil edilir:

```
lib/services/sportmonks/
├─ client.ts       # Kimlik doğrulama, rate-limit, retry/backoff, timeout — tek yer
├─ types.ts        # Ham (Raw) tipler — sağlayıcının şemasına birebir
├─ mappers.ts       # Raw → kanonik iç tip dönüşümü (saf fonksiyonlar, side-effect yok)
└─ index.ts        # Dışa açılan tipli fonksiyonlar: getFixture(), getTeamForm() ...
```

Bu katmanın zorunlu kıldığı şeyler:
- **Değiştirilebilirlik:** Sportmonks kesintiye girerse `index.ts` içindeki fonksiyon imzası değişmeden API-Football fallback'ine geçilebilir (bkz. 2.3).
- **Test edilebilirlik:** `client.ts` mock'lanarak `mappers.ts` saf fonksiyon olarak birim testlenir.
- **Rate-limit ve retry mantığı** yalnızca `client.ts` içinde yaşar, çağıran kod bundan habersizdir.
- Her servis dosyası kendi hata tipini export eder (`SportmonksError`, `FalRenderError` vb.), genel `AppError`'a normalize edilir.

### 1.5 Next.js App Router Kuralları

- Varsayılan: **Server Component**. `"use client"` yalnızca interaktivite (state, effect, event handler, tarayıcı API'si) gerektiğinde eklenir ve mümkün olduğunca ağaçta en yaprağa yakın konumlandırılır.
- Veri çekme server component içinde, doğrudan servis katmanı fonksiyonlarıyla yapılır; client tarafında veri çekimi yalnızca gerçek zamanlı/canlı senaryolar (canlı maç skoru, canlı metrik) için React Query/SWR ile yapılır.
- Route handler'lar (`app/api/**/route.ts`) ince kalır: girdi doğrulama (zod) → servis katmanı çağrısı → yanıt serileştirme. İş mantığı asla route handler içine yazılmaz.
- `revalidate`/`cache` stratejisi her route için açıkça belirtilir (varsayılana güvenilmez): statik fikstür verisi için ISR, canlı veri için `no-store` + client-side polling.

### 1.6 Veritabanı ve Auth Mimarisi (Yerel PostgreSQL + Kendi Auth Sistemimiz — Kalıcı)

Veritabanı, kimlik doğrulama ve oturum yönetimi tamamen kendi altyapımızda çalışır. Supabase veya başka bir üçüncü parti BaaS (Backend-as-a-Service) **kullanılmaz**; bu geçici bir ara çözüm değil, projenin kalıcı mimari kararıdır. Bu bölümle çelişen (örn. "ileride Supabase'e geçilecek" varsayımı içeren) her türlü eski not geçersizdir.

**Veritabanı — PostgreSQL + Prisma:**
- Yerel geliştirme veritabanı `docker-compose.yml` (proje kökü) ile ayağa kaldırılır: `postgres` servisi, `betrix` adında bir veritabanı, `5432` portunda.
- Şema `prisma/schema.prisma`'da tanımlanır: `ContentPlan` (fixtureId, scheduledFor, platforms, adSpend — bkz. `types/calendar.ts`), `AdminUser` (email, passwordHash), `SocialPlatform` (bağlı sosyal medya hesabı/kanalı), `SocialPost` (platform bazlı somut gönderi, `ContentPlan`+`SocialPlatform`'a bağlı), `PostAnalytics` (bir `SocialPost`'un beğeni/yorum/izlenme metrikleri), `AiContent` (Fal.ai prompt, `playerImageUrl`/`logoImageUrl`/`resultImageUrl` — oyuncu kesimi, logo ve nihai render ayrı ayrı saklanır, bkz. Bölüm 3) ve `TrafficLog` (checkmatch.net'e giden trafiğin `SocialPost`'a kadar izlenmesi). Yeni modüller (gerçek `Fixture` tablosu vb.) eklendikçe bu şema genişletilir.
- Şema değişiklikleri yalnızca `prisma migrate` ile, sıralı ve `prisma/migrations/` altında versiyonlanan migration dosyaları üzerinden yapılır. Veritabanına elle (psql ile doğrudan DDL) şema değişikliği yasaktır.
- Bağlantı adresi `DATABASE_URL` (`.env`, `lib/env.ts` üzerinden okunur), standart `postgresql://kullanici:sifre@host:port/veritabani` formatındadır; gizli anahtardır, asla commit edilmez.
- Client, `generator client { provider = "prisma-client" }` ile `src/generated/prisma`'ya üretilir (Prisma 7) — elle düzenlenmez, gitignore'dadır.
- Prisma 7'de runtime'da native bir driver adapter zorunlu; PostgreSQL için **`@prisma/adapter-pg`** (`pg` üzerine kurulu resmi adaptör) kullanılır.
- `lib/prisma.ts`, Next.js dev hot-reload'da bağlantı sızıntısını önlemek için `globalThis` üzerinde tekil (singleton) `PrismaClient` tutar (resmi Next.js+Prisma deseni).
- Yeni admin hesabı: `npx prisma db seed` (`prisma/seed.ts`, `ADMIN_EMAIL`/`ADMIN_PASSWORD` env'den okunur, idempotent upsert).
- **Dosya/görsel depolama:** yüklemeler ve render çıktıları proje kökündeki `storage/{uploads,generated,renders}/` altına yazılır (`lib/dashboard/storage.ts`; gitignore'da). `uploads` içerik-adresli (SHA-256) kullanıcı yüklemeleri (oyuncu fotoğrafı/logo), `generated` Fal.ai'den indirilip kalıcılaştırılan çıktılar (ör. `birefnet` oyuncu kesimi — bkz. 3.1 adım 6), `renders` nihai SVG kompozisyonlarıdır. Dosyalara doğrudan URL yoktur: yalnızca oturum doğrulayan `app/api/storage-file/route.ts` üzerinden servis edilir; genel adres `/api/files/<kova>/<dosya>`, `next.config.ts` rewrite kuralıyla oraya yönlenir (route bilerek dinamik segmentsizdir — Next dev her yeni dinamik URL için alt süreç açıp bellek baskısında dosya servisini kilitliyordu); dosya adı katı bir desenle doğrulanır (yol gezinmesi yok). Üretim ölçeğinde ihtiyaç netleştiğinde S3-uyumlu bir obje depolamaya geçiş, yalnızca `storage.ts` içinde yapılacak ayrı bir görev olarak planlanır.

**Auth — özel Credentials + JWT (dış servis yok):**
- Tek admin hesabı `AdminUser` tablosunda tutulur; şifre `bcryptjs` ile hash'lenir (`lib/auth/password.ts`), zamanlama saldırılarına karşı kullanıcı bulunamasa da sabit bir hash ile karşılaştırma yapılır (`lib/auth/credentials.ts`).
- Oturum, `jose` ile imzalanmış bir JWT olarak `httpOnly` cookie'de tutulur (`lib/auth/session.ts`, `SESSION_COOKIE_NAME`). `jose` seçildi çünkü Next.js Proxy (bkz. aşağı) hem Edge hem Node.js runtime'da çalışabilir ve `jose` her ikisiyle de uyumludur (`jsonwebtoken` Edge'de çalışmaz).
- Giriş formu bir Server Action'dır (`app/login/actions.ts`) — zod ile doğrulanır, başarılı girişte cookie set edilir, `redirectTo` yalnızca site-içi göreli yollara izin verecek şekilde doğrulanır (open-redirect koruması).
- **Route koruması:** `src/proxy.ts` — Next.js 16'da `middleware.ts` konvansiyonu deprecate edildi ve `proxy.ts`'e taşındı (fonksiyon adı `middleware` → `proxy`); `/dashboard`, `/calendar` ve `/studio` altındaki tüm yollar, geçerli oturum cookie'si yoksa `/login?from=<yol>`'a yönlendirilir. Giriş sonrası varsayılan hedef `/dashboard`'tur; `/api/files` proxy kapsamında olmadığından oturumu kendisi doğrular, veritabanına yazan her Server Action da `getCurrentSession()` ile oturumu ayrıca kontrol eder.
- Yetki modeli şu an tek admin rolüyle sınırlıdır. Çoklu rol/izin (RBAC) ihtiyacı doğarsa `AdminUser` tablosuna alan eklenerek bu katman genişletilir — ayrı bir auth sağlayıcıya geçiş gerekmez, bu katman kalıcıdır.

### 1.7 Ortam Değişkenleri

- Tüm `process.env` erişimi `lib/env.ts` üzerinden, zod ile doğrulanmış tipli bir nesne aracılığıyla yapılır. Kod içinde çıplak `process.env.X` yasaktır. (Tek istisna: `prisma7.config.ts`, Prisma CLI'ın kendi env yükleme mekanizması gereği `dotenv` kullanır — uygulama kodu değildir. `prisma/seed.ts` dahil tüm uygulama/araç kodu `lib/env.ts` üzerinden okur.)
- Gizli anahtarlar (`FAL_KEY`, `SPORTMONKS_API_KEY`, `META_APP_SECRET`, `TIKTOK_CLIENT_SECRET`, `YOUTUBE_API_KEY`, `X_API_SECRET`, `API_FOOTBALL_KEY`, `CHECKMATCH_MAC_SERVER_URL`, `CHECKMATCH_API_SECRET`, `JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `DATABASE_URL`) yalnızca sunucu tarafında okunur, `NEXT_PUBLIC_` öneki ile asla dışa açılmaz.
- **Fail-fast:** `JWT_SECRET` (üretimde en az 32 karakter) ve `DATABASE_URL` (`postgresql://`) zorunludur, varsayılan değerleri yoktur; boş string "tanımsız" sayılır. Geçersizse `lib/env.ts` hata fırlatır, `src/instrumentation.ts` bunu sunucu açılışında tetikleyip süreci `exit 1` ile durdurur. Yalnızca `next build` aşamasında (`NEXT_PHASE`) derlemenin geçmesi için yer tutucu kullanılır.
- `TRACK_ALLOWED_ORIGINS` (virgülle ayrılmış origin listesi) ve `TRACK_SITE_KEY` (isteğe bağlı, GA ölçüm ID'si gibi gizli olmayan bir "site anahtarı") gizli değildir — `/api/track` uç noktasının CORS/istemci doğrulaması için kullanılır, bkz. 1.8 ve `app/api/track/route.ts`.
- **Sosyal OAuth (bkz. 4.4):** `APP_BASE_URL` (OAuth `redirect_uri` kökü, gizli değil), `SOCIAL_TOKEN_ENCRYPTION_KEY` (64 hex; üretimde bağlantı için zorunlu, geliştirmede boşsa `JWT_SECRET`'tan türetilir), `SOCIAL_USE_MOCKS` (tanımsızsa üretim dışında `true`), `META_APP_ID`/`META_APP_SECRET`, `TIKTOK_CLIENT_KEY`/`TIKTOK_CLIENT_SECRET`, `YOUTUBE_CLIENT_ID`/`YOUTUBE_CLIENT_SECRET`, `X_CLIENT_ID`/`X_CLIENT_SECRET`. Sırlar yalnızca sunucuda okunur.

### 1.8 Dashboard Modül Mimarisi

`app/dashboard/layout.tsx` sol menü (`components/features/dashboard/sidebar*.tsx`) ve içerik kabuğunu sağlar; menü `lib/dashboard/nav.ts` listesinden üretilir. **Yeni modül eklemek:** `app/dashboard/<modül>/page.tsx` (+ gerekiyorsa `actions.ts`) aç, `nav.ts`'e bir satır ekle — layout ve aktif-menü vurgusu otomatik gelir.

| Modül | Route | Ana model | Not |
|---|---|---|---|
| Genel Bakış | `/dashboard` | hepsi | 4 modülün özet kartları |
| Maç Merkezi | `/dashboard/matches` | `AiContent` | Gerçek fikstür (API-Football, 7 gün), maç başına içerik türü menüsü + "Stüdyoya Git", onay kuyruğu — bkz. 1.10 |
| İçerik Takvimi | `/dashboard/calendar` | `SocialPost` | Ay/Hafta/Liste görünümü, planlama, düzenleme, Hazırlanıyor/Paylaşıldı |
| Etkileşim & Reklam | `/dashboard/analytics` | `PostAnalytics`, `SocialConnection` | Bağlı hesaplardan "Senkronize et" ile çekilir, bağlı olmayanlarda elle girilir; `?sort=` (En Çok Yorum Alan/Kaydedilen/İzlenen…) + `?platform=` filtresi; "Hangi istatistik tutuyor?" analizi (`content-insights-stats.ts`) — bkz. 4.4 |
| AI İçerik Stüdyosu | `/dashboard/studio` | `AiContent` | Fal.ai `flux`+`birefnet` ile gerçek görsel üretir (`FAL_KEY` zorunlu, boşsa form kilitlenir); istatistik/logo/marka katmanı her zaman programatik SVG'dir, bkz. Bölüm 3 |
| Web Trafiği | `/dashboard/traffic` | `TrafficLog` | Gün sınırları Europe/Istanbul; IP'ler arayüzde maskelenir; `POST /api/track` ile beslenir |

Kurallar: (1) sayfalar `force-dynamic` Server Component'tir; durum (görünüm, tarih, sıralama, açık düzenleme paneli) URL parametrelerinde tutulur. (2) Dahili CRUD Server Action'dır; `app/api` yalnızca dış tüketiciler (ör. `track/`) ve dosya servisi (`files/`) içindir. (3) Sorgular `lib/dashboard/*-data.ts`, saf hesaplamalar `*-stats.ts` dosyalarındadır (birim test edilebilir). (4) `app/api/track/route.ts`, checkmatch.net'ten gelen trafiği `TrafficLog`'a yazan, oturumsuz ama dışa açık bir uç noktadır — kimlik doğrulaması yerine üç katman kullanılır: `TRACK_ALLOWED_ORIGINS` ile sunucu tarafında zorunlu kılınan CORS, isteğe bağlı gizli olmayan `TRACK_SITE_KEY`, ve `lib/dashboard/rate-limit.ts`'teki IP başına bellek-içi rate limit (tek instance için yeterli; yatay ölçeklenirse paylaşılan bir depoya taşınmalı).

### 1.9 Üretim Dağıtımı (Docker — Mac Mini)

Üretim, Mac Mini üzerinde `docker-compose.prod.yml` ile çalışır. `docker-compose.yml` yalnızca yerel geliştirme veritabanıdır.

```
internet ──HTTPS──► Cloudflare ──tünel──► cloudflared ──[frontend]──► caddy:80 ──► app:3000 ──[backend, internal]──► postgres:5432
```

- **Cloudflare Tunnel:** sunucu ev bağlantısındadır; modemde port açılmaz. `cloudflared` Cloudflare'e giden bir tünel açar (`CLOUDFLARE_TUNNEL_TOKEN`), yönlendirme (`www.betrix.pro → http://caddy:80`) Cloudflare panelinde tanımlıdır. HTTPS Cloudflare kenarında sonlanır; Caddy ACME kullanmaz ve host'a port açmaz. Gerçek ziyaretçi IP'si `CF-Connecting-IP`'den alınır (Caddyfile `client_ip_headers`), uygulamaya tek değerli `X-Forwarded-For` olarak iletilir.

- **İmaj:** `Dockerfile` çok aşamalıdır (`deps → builder → runner`), `next.config.ts` içinde `output: "standalone"`. `runner` non-root (`nextjs`, uid 1001) çalışır; uygulama dosyaları root'a aittir, yalnızca `storage/` ve `.next/cache` yazılabilir. `migrator` hedefi tam `node_modules` içerir ve `prisma migrate deploy` / `db seed` için kullanılır.
- **Ağ:** `backend` ağı `internal: true`'dur (internete çıkış yok); postgres ve app dışarıya port açmaz. App, dış API'ler (Fal.ai vb.) için ayrıca `frontend` ağındadır. Hiçbir servis host'a port açmaz; dış dünyaya tek yol Cloudflare Tunnel'dır.
- **Sertleştirme:** app `read_only` kök dosya sistemi, `cap_drop: ALL`, tüm servislerde `no-new-privileges`, log rotasyonu. Postgres `scram-sha-256` ile şifreli.
- **Volume'lar:** `pgdata` (veritabanı), `storage` (yüklemeler/render çıktıları, bkz. 1.6), `next_cache`, `caddy_data` (TLS sertifikaları — silinirse Let's Encrypt limitine takılabilir), `caddy_config`.
- **Sırlar:** `.env.production` (gitignore'da, `chmod 600`) — şablon `.env.production.example`. `DATABASE_URL` compose tarafından `POSTGRES_*`'tan üretilir; şifre URL'e girdiği için hex olmalıdır (`openssl rand -hex 32`). Sır asla imaja girmez (`.dockerignore`).
- **Akış:** `migrate` servisi bekleyen migration'ları uygulayıp çıkar; app yalnızca o başarıyla bitince kalkar, Caddy app sağlıklı olunca kalkar.

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
# İlk kurulumda bir kez — admin hesabı:
docker compose -f docker-compose.prod.yml --env-file .env.production run --rm migrate npx prisma db seed --config prisma7.config.ts
```

**Not:** Oturum çerezi üretimde `Secure`'dur; giriş yalnızca HTTPS üzerinden (Caddy) çalışır, `app:3000`'e doğrudan HTTP ile giriş yapılamaz.

### 1.10 Yarı Otomatik İçerik Motoru (Human-in-the-loop — Kurucu Kararı)

Sistemin dili ve içerik kalitesi manuel testle oturtulana kadar içerik üretimi **tam otomatik değildir**: cron/worker/zamanlayıcı ile kendi kendine içerik üreten veya yayınlayan kod yolu **eklenmez**. Her üretim bir admin tıklamasıyla tetiklenir ve onaysız hiçbir içerik yayına hazır sayılmaz.

**İçerik türü kataloğu:** Maç Merkezi ve Takvim'in maç detayındaki menü `lib/dashboard/content-types.ts`'ten beslenir (tipler `types/content-type.ts`; tek kaynak, ileride `rules` alanı buraya eklenecek). Ortak bileşen `StudioLauncher`: aktif türde "Stüdyoya Git" → `<route>?fixtureId=<id>`, "Yakında" türlerde pasif. Stüdyo `fixtureId`'yi sunucuda okur, 7 günlük fikstürde doğrular ve formu dolu açar (şu an: Maç Günü). Yeni bir stüdyo aktifleştiğinde aynı `fixtureId` ön-doldurmasını eklemelidir. Her tür `phase` (maç öncesi/sonrası) taşır. Üretilen kayıt `AiContent.contentType`'a tür kimliğini yazar (`publishAt` = planlanan yayın zamanı, opsiyonel); `/calendar` maç kartındaki ilerleme çubuğu (`x/12`, yeşil onaylı / amber taslak) ve maç panelindeki **İçerik Kontrol Merkezi** (tür başına durum + İncele/Stüdyoya Git/Yakında) bu sütundan türetilir (`lib/calendar/calendar-month.ts`, `content-progress.ts`).

**Akış (taslak motoru — Stüdyo):** `lib/dashboard/draft-engine.ts::createMatchDraft()`:
1. Gerçek maç verisi (`lib/services/api-football::getMatchStats` — fikstür, iki takımın son 5 bitmiş maçı: form, gol ve xG ortalamaları, H2H).
2. Fal.ai `flux` arka planı (+ stüdyodan yüklendiyse `birefnet` oyuncu kesimi) → kalıcı depolamaya indirilir.
3. Görsel `renderDraftImage()` ile çizilir; gönderi metni `draft-caption.ts` ile **şablondan** üretilir (LLM yok — her sayı snapshot'tan gelir, olmayan metrik yazılmaz).
4. `AiContent` kaydı `status = DRAFT`, `statsSnapshot` (üretim anındaki gerçek veri) ve `renderOptions` ile yazılır → admin `/dashboard/drafts/<id>`'ye yönlendirilir.

**İnceleme ekranı:** "Kaydet ve yeniden çiz" görseli depodaki katmanlardan yeniden çizer (**ücretsiz**, Fal.ai'ye gidilmez); "Arka planı yeniden üret" Fal.ai'ye gider (**ücretli**) — maç tansiyonu (`derbyIntensity`, bkz. 3.2.3) burada admin tarafından sınıflandırılır. Onay/ret yalnızca `DRAFT` kayıtlara uygulanır; karara bağlanmış taslak düzenlenemez. Stüdyo'nun manuel üretimi de aynı motoru kullanır ve DRAFT doğar.

**Kurallar:** (1) Statü geçişleri yalnızca `draft-engine.ts` içinden (`updateDraft`, `regenerateDraftBackground`, `decideDraft`). (2) `statsSnapshot` sonradan değişmez — taslak, üretildiği andaki veriyi gösterir. (3) Yeniden render/arka plan değişiminde eski dosyalar silinir (yetim dosya bırakılmaz).

### 1.11 Medya / Referans Kütüphanesi

Stüdyoda her üretimde logo/oyuncu fotoğrafı yüklemek yerine kalıcı, seçilebilir bir kütüphane (`/dashboard/library`, model `MediaAsset`).

- **Klasörler = `MediaCategory`:** `LOGO` (takım/marka/sponsor), `PLAYER` (oyuncu fotoğrafı, ≥1024px kısa kenar — birefnet için), `REFERENCE` (stil/kompozisyon referansı; şimdilik yalnızca arşiv, üretim hattına bağlanması ayrı bir görev).
- **Depolama:** `storage/library/<kategori>-<sha256>.<uzantı>` — içerik-adreslidir; aynı dosya aynı klasöre ikinci kez eklenmez (`@@unique([category, sha256])`). Tüm işlemler `lib/dashboard/media-library.ts`'ten geçer; istemci bileşenleri yalnızca `media-library-meta.ts`'i (sunucu bağımlılığı yok) içe aktarır.
- **Stüdyo entegrasyonu:** logo/oyuncu alanlarında "kütüphaneden seç" önceliklidir; yeni yüklenen görsel sunucuda kütüphaneye **otomatik** kaydedilir. Taslak motoru logoyu kütüphane URL'i olarak alır (`CreateDraftInput.logoImageUrl`), ayrıca kopyalamaz.
- **Silme:** kayıt silinir; dosya yalnızca hiçbir `AiContent` ona referans vermiyorsa diskten kaldırılır (aksi halde taslakların Fal.ai'siz yeniden render'ı logosuz kalırdı).
- Logolarda isteğe bağlı `teamId` (API-Football) / `teamName` tutulur — ileride maç seçilince iki takımın logosunun otomatik gelmesi bu alanla yapılacak.

### 1.12 Planlanan: Finans Modülü (Gelir/Gider ve Aylık Bilanço)

Henüz kod yok — mimari bu yapıya göre açık tutulur, yeni bir yapı icat edilmez:

```
src/app/dashboard/finance/          # Aylık bilanço sayfası (+ actions.ts) — nav.ts'e tek satır
src/lib/dashboard/finance-data.ts   # Sorgular (Prisma)
src/lib/dashboard/finance-stats.ts  # Saf hesaplamalar (aylık toplam, kategori kırılımı, bilanço)
src/types/finance.ts                # Kanonik tipler
prisma: FinanceEntry { kind: INCOME|EXPENSE, category, amount (Decimal, TRY), occurredAt, note, source }
```

- **Para birimi:** tutarlar `Decimal` (asla `Float`) ve TRY; `lib/calendar/ad-spend.ts::formatAdSpend` biçimi.
- **Otomatik gider kaynakları (bağlanacak):** Fal.ai (her `AiContent` üretimi / arka plan yenileme — `draft-engine.ts` tek çağrı noktasıdır), API-Football/Sportmonks abonelikleri, sunucu (Mac Mini elektrik/internet, alan adı). Reklam bütçesi (`ContentPlan.adSpend`) **planlanan** harcamadır; gerçekleşen harcama ayrı `FinanceEntry` olarak girilir.
- Gelir/gider kaydı yalnızca Server Action ile, oturum kontrollü; silme yerine düzeltme kaydı tercih edilir (denetim izi).

---

## 2. Spor Analitiği & Veri Kuralları

### 2.1 Veri Kaynağı Hiyerarşisi

- **Sportmonks — birincil kaynak.** xG, tehlikeli atak sayısı, form serileri, sakatlık/ceza verisi, canlı olay akışı (goal, card, substitution, VAR).
- **API-Football — ikincil kaynak / çapraz doğrulama.** Sportmonks kesintisinde fallback; kritik veri noktalarında (skor, kart) iki kaynak çelişirse Sportmonks esas alınır ve uyuşmazlık loglanır.
- **Mevcut durum (FAZ 9):** Fikstür, form, xG ve H2H şu an **API-Football'dan** gelir (Ultra plan). Gerekçe: fikstür listesi API-Football kimlikleriyle çalışır ve iki sağlayıcı arasında takım/maç kimliği eşlemesi henüz yok; Sportmonks xG `type_id` eşlemesi doğrulanmamış (bkz. `sportmonks/mappers.ts`). Sportmonks'u birincil yapmak için önce kimlik eşleme tablosu kurulmalıdır. xG, maç istatistiklerindeki `expected_goals`'tan hesaplanır; kupa gibi kapsam dışı maçlarda yoktur ve ortalamaya girmez (`xgMatchesSampled`).
- **Hız limiti:** API-Football 450 istek/dk'yı saniyeye yayılmış uygular; paralel istek patlamaları `rateLimit` hatası verir (HTTP 200 + `errors`). `api-football/client.ts` tüm istek başlangıçlarını süreç genelinde ≥150 ms aralıkla sıralar (~400/dk) ve limit hatasında kısa bekleyip yeniden dener. Yalnızca başarılı yanıtlar önbelleğe alınır. Soğuk bir ay görünümü (42 gün = 42 istek) ~5 sn, önbellekten ~150 ms sürer.
- **Projede sahte maç verisi yoktur.** Hem dashboard hem `/calendar` (ay ızgarası, `?month=yyyy-MM`) gerçek fikstürü gösterir; takvimdeki içerik durumu `AiContent`'ten türetilir (onaylı → Üretildi, taslak → Bekliyor, yok → Fikir), reklam bütçesi `ContentPlan` tablosuna yazılır.

### 2.2 Kanonik İç Veri Modelleri (`types/sports.ts`)

```ts
interface Fixture {
  id: string;                 // içsel UUID, sağlayıcı ID'si değil
  providerIds: { sportmonks?: number; apiFootball?: number };
  kickoffUtc: string;         // ISO 8601, UTC
  status: 'SCHEDULED' | 'LIVE' | 'HT' | 'FT' | 'POSTPONED' | 'CANCELLED';
  homeTeam: TeamRef;
  awayTeam: TeamRef;
  competition: CompetitionRef;
  derbyIntensity: 'NONE' | 'RIVALRY' | 'DERBY' | 'ELITE_DERBY'; // bkz. 3.3
}

interface TeamForm {
  teamId: string;
  last5: MatchResultLetter[];      // ['W','D','L','W','W']
  homeLast5?: MatchResultLetter[];
  awayLast5?: MatchResultLetter[];
  xgFor: number;                   // maç başı ortalama
  xgAgainst: number;
  dangerousAttacksAvgPerMatch: number;
}

interface InjuryReport {
  playerId: string;
  teamId: string;
  status: 'OUT' | 'DOUBTFUL' | 'SUSPENDED';
  expectedReturn?: string;         // ISO 8601 tarih, biliniyorsa
  squadImpactScore: number;        // 0-100, iç hesaplanan etki skoru
}
```

### 2.3 Veri Kullanım Senaryoları (Panoda)

| Metrik | Panodaki kullanım | Tazelik gereksinimi |
|---|---|---|
| xG (Beklenen Gol) | Maç öncesi karşılaştırma kartı, form momentum grafiği, canlı maçta "beklenen skor" göstergesi | Maç öncesi: 15 dk cache. Canlı: 60 sn polling. |
| Form durumu (son 5) | WWDLL dizisi rozetleri, ev/deplasman ayrımlı form | 30 dk cache |
| Tehlikeli atak sayısı | Canlı baskı göstergesi, "momentum barı" görselinde kullanılır | Canlı: 30-60 sn polling |
| Sakatlık/ceza | Kadro etki skoru → içerik önceliklendirme (üst düzey oyuncu eksikse otomatik "kadro haberi" içerik tetiklenir) | Maç öncesi: 6 saat cache, kickoff'a 2 saat kala zorunlu yenileme |
| Head-to-head | Maç önü içerikte "son 5 karşılaşma" grafiği | Statik, maç başına 1 kez çekilir |

### 2.4 Dayanıklılık (Resilience) Kuralları

1. Sportmonks isteği başarısız olur veya 3 saniye içinde yanıt vermezse, servis katmanı otomatik olarak API-Football'a düşer (`lib/services/sportmonks/index.ts` içindeki fonksiyonlar bu fallback'i şeffaf şekilde uygular; çağıran kod hangi sağlayıcının yanıt verdiğini bilmek zorunda değildir, ama yanıt meta verisinde `source: 'sportmonks' | 'api-football'` işaretlenir).
2. Canlı maç verisi polling'i, maçın durumuna göre dinamik aralıkla çalışır: `SCHEDULED` → polling yok, `LIVE` → 30-60 sn, `FT` sonrası → 5 dk (maç sonu istatistiklerin kesinleşmesi için).
3. Her iki sağlayıcı da başarısız olursa UI, son bilinen veriyi "bayat veri" (stale) rozetiyle gösterir; sessizce boş veya sıfır göstermek yasaktır.
4. API kotası (rate limit) tüketimi Postgres'te loglanır; kota %80'e ulaştığında düşük öncelikli sorgular (geçmiş sezon istatistikleri gibi) otomatik ertelenir.

---

## 3. AI Görsel & Render İşleme Motoru (Skill)

Bu bölüm, `skills/render-engine/` altında yaşayan pipeline'ın kurallarını tanımlar. Bu mantık ayrıca bir Claude Code Skill'i (`.claude/skills/render-engine/SKILL.md`) olarak da paketlenip tekrar kullanılabilir hale getirilmelidir; burada tanımlanan kurallar o skill dosyasının da referans kaynağıdır.

### 3.1 Fal.ai `birefnet` — Oyuncu Arka Plan Temizleme Pipeline'ı

**Amaç:** Kaynak oyuncu fotoğrafından, kusursuz (halo/artefaktsız) transparan PNG üretmek.

Pipeline adımları (sıralı, atlanamaz):

1. **Girdi doğrulama + AI Upscale:** Kaynak görsel JPEG/PNG/WebP, en az 256px kısa kenar (`PLAYER_MIN_SHORT_SIDE`), tek kişi belirgin şekilde kadrajda; bunu sağlamayanlar reddedilir ve neden bildirilir. Kısa kenarı 1024px'in (`PLAYER_TARGET_SHORT_SIDE`) altındaki görseller birefnet'ten hemen önce Fal.ai `esrgan` (Real-ESRGAN x4plus, en fazla 4×, yüz restorasyonu kapalı) ile netleştirilerek büyütülür — `lib/dashboard/player-upscale.ts`.
2. **Ön işleme:** Görsel yerel depolamaya (bkz. 1.6) `raw/` klasörüne yüklenir, içerik-adresli hash ile isimlendirilir (aynı görsel iki kez işlenmez, cache'ten döner).
3. **Birefnet çağrısı:** `lib/services/fal/index.ts::removeBackground()` üzerinden, model parametreleri sabittir (yüksek hassasiyet modu, `refine_foreground: true`). Doğrudan Fal.ai SDK route handler veya component içinde çağrılmaz (bkz. 1.4).
4. **Alfa kanalı doğrulama:** Çıktının alfa kanalı analiz edilir — kenar bölgesinde (forma/saç hatları) ani alfa sıçramaları (`halo` artefaktı) tespit edilirse otomatik olarak `refine_foreground` parametresi artırılarak **1 kez** yeniden denenir. İkinci denemede de başarısızsa görsel "manuel inceleme gerekli" kuyruğuna düşer, otomatik yayınlanmaz.
5. **Kenar yumuşatma kontrolü:** Kenar pikselleri keskinlik histogramıyla ölçülür; aşırı sert (aliasing) veya aşırı bulanık (feathering) kenarlar toleransın dışındaysa aynı retry mantığı uygulanır.
6. **Depolama:** Onaylanan transparan PNG, `processed/players/<playerId>/<hash>.png` yoluna, kayıp sıkıştırma yapılmadan (PNG-24 + alfa) yazılır. Postgres `player_assets` tablosuna meta veri (boyut, kaynak, işlem tarihi, kalite skoru) kaydedilir.

**Kural:** Bu pipeline'ın hiçbir adımı manuel olarak atlanamaz; "hızlı geçiş" için doğrulama adımlarını devre dışı bırakan bir kod yolu eklenemez.

### 3.2 Fal.ai `flux` — Stadyum Arka Planı Prompt Mühendisliği

**Amaç:** Takımın renk kimliğine ve maçın "derbi tansiyonuna" uygun, karanlık/neon/sinematik stadyum arka planları üretmek.

#### 3.2.1 Prompt Şablon Yapısı (zorunlu 6 blok, bu sırayla birleştirilir)

```
[SUBJECT/SCENE] + [LIGHTING] + [COLOR GRADING] + [ATMOSPHERE/MOOD] + [CAMERA/COMPOSITION] + [NEGATIVE PROMPT]
```

1. **SUBJECT/SCENE:** `"empty professional football stadium interior, wide bowl, floodlights, night match atmosphere"` — oyuncu/insan figürü ASLA subject prompt'una dahil edilmez (oyuncular ayrı katman, bkz. 3.4).
2. **LIGHTING:** Takımın ana renginden türetilen ışık kaynağı tanımı — örn. ev sahibi ana rengi kırmızı ise `"dramatic red rim lighting from floodlights, volumetric light shafts cutting through stadium mist"`.
3. **COLOR GRADING:** İki takımın hex renk kodlarından üretilen bir gradient/ışık paleti tanımı — örn. `"cinematic color grade blending #DA020E and #6C1D45, deep shadows, high contrast teal-and-orange base with team accent overrides"`.
4. **ATMOSPHERE/MOOD:** Derbi yoğunluğuna göre kademeli (bkz. 3.3).
5. **CAMERA/COMPOSITION:** `"low-angle wide shot, shallow depth of field, negative space in lower-third and left third for typography overlay"` — kompozisyonda mutlaka veri/tipografi katmanı için boş alan bırakılır.
6. **NEGATIVE PROMPT (sabit, her çağrıda eklenir):** `"no human figures, no faces, no visible sponsor logos, no readable text, no watermarks, no blurry crowd close-ups, no oversaturation, no cartoonish style"`.

#### 3.2.2 Takım Renk Kodu Enjeksiyonu

- Her takımın `primaryColorHex`/`secondaryColorHex` alanı Postgres `teams` tablosunda tutulur.
- Prompt oluşturucu (`skills/render-engine/promptBuilder.ts`), iki takımın renklerini alıp çakışma/uyum kontrolü yapar (örn. iki takım da kırmızı ise ikincil takıma `secondaryColorHex` zorunlu kullanılır, aksi halde görsel ayrım kaybolur).

#### 3.2.3 Derbi Tansiyonu Kademeleri (`derbyIntensity`)

| Kademe | Mood/Atmosfer prompt eki | Örnek kullanım |
|---|---|---|
| `NONE` | `"calm professional match night, balanced neutral lighting"` | Lig ortası, rekabetsiz maç |
| `RIVALRY` | `"tense competitive atmosphere, sharp contrast lighting, charged energy"` | Bölgesel rekabet |
| `DERBY` | `"electric neon-accented rivalry atmosphere, pulsing crowd energy implied through light patterns, high saturation team-color neon glow"` | Şehir derbisi |
| `ELITE_DERBY` | `"apocalyptic high-stakes cinematic atmosphere, extreme dramatic lighting, smoke and light beams, maximum tension, blockbuster movie poster energy"` | El Clasico düzeyi büyük maçlar |

**Kural:** `derbyIntensity` alanı boşsa render tetiklenmez; sistem varsayılan olarak `NONE`'a düşmez, önce sınıflandırma yapılması zorunludur (bkz. Bölüm 4.2'deki takvim durum makinesi ile entegre).

### 3.3 Çoklu Format Şablon Standartları

| Format | Boyut | Oran | Platform | Güvenli alan kuralı |
|---|---|---|---|---|
| IG Feed | 1080×1350 | 4:5 | Instagram Feed | Üst %8, alt %10 payda kritik içerik yok (kırpma toleransı) |
| Story/Reels/TikTok | 1080×1920 | 9:16 | Instagram Story/Reels, TikTok | Üst 250px ve alt 320px platform UI (profil, aksiyon butonları, caption) için tamamen boş — kritik veri/logo bu bölgeye asla yerleştirilmez |
| X/Twitter | 1200×675 | 16:9 | X (Twitter) kartı | Kenarlardan %5 güvenli boşluk, yatay kompozisyon zorunlu |

Her format için ayrı bir render şablonu (`skills/render-engine/templates/<format>.tsx` veya eşdeğer) tutulur; tek bir şablonun `scale()` ile üç orana zorlanması yasaktır — her oran kendi kompozisyon mantığına (oyuncu konumu, veri bloğu yerleşimi) sahiptir.

### 3.4 CSS Katmanlama Kuralları

Render çıktısı, aşağıdaki sabit z-index sırasıyla, her biri ayrı bir katman (layer) olarak birleştirilir. Bu sıra hiçbir şablonda değiştirilemez:

```css
.render-canvas {
  --z-background: 0;      /* flux stadyum arka planı */
  --z-light-bloom: 10;    /* ışık süzmesi / god-ray overlay, mix-blend-mode: screen */
  --z-players: 20;        /* birefnet çıktısı transparan oyuncu PNG'leri */
  --z-data-layer: 30;     /* istatistik kartları, xG grafiği, form rozetleri, tipografi */
  --z-branding: 40;       /* CheckMatch.net logosu + sponsor logoları — her zaman en üstte */
}
```

1. **Arka plan katmanı (`z-background`):** Flux çıktısı, tam kanvas boyutunda, `object-fit: cover`.
2. **Işık süzmesi katmanı (`z-light-bloom`):** Ayrı bir overlay PNG/gradient, `mix-blend-mode: screen` veya `overlay` ile arka planla harmanlanır; oyuncuların arkasında kalmalı, oyuncuları asla örtmemeli.
3. **Oyuncular katmanı (`z-players`):** Birefnet transparan PNG'leri; gölge, format bazlı kompozisyon kurallarına göre (bkz. 3.3) konumlandırılır.
4. **Veri/tipografi katmanı (`z-data-layer`):** Tüm istatistik, skor, xG, form verisi. Bu katmanın arkasına her zaman okunabilirlik için bir kontrast panel/gradient (`backdrop-filter: blur()` veya yarı saydam gradient) eklenir — çıplak metin doğrudan render arka planına yerleştirilmez.
5. **Marka/sponsor katmanı (`z-branding`):** CheckMatch.net logosu her formatta sabit konum ve minimum boyutla (marka kılavuzuna göre) yer alır; sponsor logoları varsa CheckMatch logosunun görsel ağırlığını geçemez.

**Kural:** Yeni bir katman eklenmesi gerekiyorsa (örn. "canlı" rozeti), mevcut 5 katmanın z-index aralığı içine (`z-data-layer` ile `z-branding` arası, örn. `35`) yerleştirilir, mevcut sıralama asla bozulmaz.

---

## 4. Pazarlama, Analitik ve Takvim Sistemi

### 4.1 Platform Metrik Veri Modelleri

Her platformun ham metrik yanıtı, `lib/services/<platform>/mappers.ts` içinde aşağıdaki kanonik modele dönüştürülür:

```ts
interface PostMetrics {
  postId: string;                 // içsel UUID
  platform: 'meta_instagram' | 'meta_facebook' | 'tiktok' | 'youtube' | 'x';
  providerPostId: string;
  fixtureId: string;              // hangi maça bağlı içerik
  contentStage: 'PRE_MATCH' | 'LIVE' | 'POST_MATCH';
  publishedAtUtc: string;
  impressions: number;
  reach: number;
  views: number;                  // video izlenme (YouTube/TikTok/Reels)
  saves: number;                  // kaydetme (IG/TikTok)
  engagementRate: number;         // (like+comment+share+save) / reach
  linkClicks: number;             // CheckMatch.net'e giden tıklama
  lastSyncedAtUtc: string;
}
```

| Platform | API | Özel alanlar |
|---|---|---|
| Meta (Instagram/Facebook) | Meta Graph API | `saves`, `reach`, `video_avg_time_watched` |
| TikTok | TikTok API (Business/Content) | `shares`, `avg_watch_time`, `full_video_watched_rate` |
| YouTube | YouTube Data API v3 + Analytics API | `watchTimeMinutes`, `subscribersGained`, `averageViewDuration` |
| X | X API v2 | `bookmarks`, `reposts`, `profileClicks` |

**Senkronizasyon kuralı:** Metrik çekimi her içerik için yayından sonra kademeli aralıklarla yapılır (1 saat, 6 saat, 24 saat, 72 saat sonra) — sabit polling yerine kademeli (decaying) senkronizasyon, gereksiz API kotası tüketimini önler.

### 4.2 Fikstür Tabanlı Takvim Durum Makinesi

İçerik takvimi, her fikstür için aşağıdaki durum makinesini takip eder (`content_calendar` tablosu, discriminated union ile tipte yansıtılır):

```
SCHEDULED → PRE_MATCH_READY → PRE_MATCH_PUBLISHED → LIVE_TRACKING → POST_MATCH_READY → POST_MATCH_PUBLISHED → ARCHIVED
                                                         │
                                                         └─(maç iptal/ertelenirse)→ CANCELLED
```

| Durum | Tetikleyici | Beklenen içerik |
|---|---|---|
| `SCHEDULED` | Fikstür Sportmonks'tan çekildiğinde otomatik oluşturulur | — |
| `PRE_MATCH_READY` | Kickoff'a T-24 saat; form/xG/sakatlık verisi tam | Maç önü analiz görseli, tahmin kartı |
| `PRE_MATCH_PUBLISHED` | İçerik yayınlandı, UTM'li link CheckMatch'e eklendi | — |
| `LIVE_TRACKING` | Kickoff anında otomatik geçiş | Gol/kart/önemli xG değişimi anlarında olay-tetiklemeli mikro içerik |
| `POST_MATCH_READY` | Maç `FT` durumuna geçtikten 5 dk sonra, nihai istatistikler kesinleştiğinde | Maç sonu skor/istatistik özet görseli |
| `POST_MATCH_PUBLISHED` | İçerik yayınlandı | — |
| `ARCHIVED` | POST_MATCH_PUBLISHED'den 72 saat sonra, metrik son senkronizasyonu tamamlandığında | Metrik raporu kapatılır |
| `CANCELLED` | Fikstür `POSTPONED`/`CANCELLED` olursa | Planlanan içerikler otomatik iptal edilir, kullanıcı bilgilendirilir |

**Kural:** Durum geçişleri yalnızca `lib/services/calendar/stateMachine.ts` içinden yapılır; UI veya route handler doğrudan `content_calendar.status` alanını güncellemez — her geçiş merkezi bir fonksiyondan geçmek zorundadır (geçersiz geçişler derleme zamanında engellenir, discriminated union sayesinde).

### 4.3 CheckMatch.net Dönüşüm İzleme — UTM Standardı

Her yayınlanan içerikteki CheckMatch.net linki aşağıdaki sabit şemaya uymalıdır:

```
https://checkmatch.net/{hedef-yol}?utm_source={platform}&utm_medium=social&utm_campaign={fixtureSlug}&utm_content={contentStage}-{format}
```

| Parametre | Değer kümesi | Örnek |
|---|---|---|
| `utm_source` | `instagram`, `tiktok`, `youtube`, `x`, `facebook` | `instagram` |
| `utm_medium` | Her zaman sabit `social` | `social` |
| `utm_campaign` | `<ev-takim>-vs-<deplasman-takim>-<YYYYMMDD>` (kebab-case, ASCII) | `galatasaray-vs-fenerbahce-20260921` |
| `utm_content` | `<contentStage>-<format>` | `pre_match-story`, `post_match-feed` |

**Gönderi atfı:** linke ayrıca `cm_post=<SocialPost.id>` eklenir. checkmatch.net'teki izleme kodu (`lib/dashboard/tracker-snippet.ts` — Web Trafiği sayfasında kopyalanabilir) bu parametreyi okuyup oturum boyunca `/api/track`'e iletir; böylece ziyaret, trafik kaynağı ve Reklam Bütçeleri'ndeki "ziyaret başı maliyet" o gönderiye/maça yazılır. Ziyaretçi kimliği tarayıcıda kalıcıdır (`localStorage`): "Tekil ziyaretçi" = dönemdeki farklı kimlik, "Yeni ziyaretçi" = ilk kez görülen kimlik (`isUniqueVisit`, eşzamanlı isteklerde kimlik başına advisory lock ile tekil).

**Kural:** UTM link üretimi tek bir yardımcı fonksiyondan (`lib/dashboard/tracking-link.ts::buildTrackingLink`) geçer; hiçbir bileşen elle string birleştirme (`+`) ile link üretmez — parametre sırası ve encoding tutarlılığı bu fonksiyon tarafından garanti edilir. Link, Postgres `content_links` tablosuna, hangi içerikten üretildiği referansıyla kaydedilir ki tıklama→dönüşüm zinciri geriye doğru izlenebilsin.

### 4.4 Sosyal Hesap Bağlama ve Veri Çekme Motoru (Kurucu Vizyonu: Veriye Dayalı İçerik Planlama)

İçerik planlaması, yayınlanan gönderilerin gerçek etkileşim verisine (beğeni, yorum, paylaşım, kaydetme, izlenme, erişim) dayanır.

```
/api/auth/<slug>/connect ──► sağlayıcı onay ekranı ──► /api/auth/<slug>/callback ──► SocialConnection (token'lar şifreli)
"Senkronize et" ──► lib/services/social-metrics.ts ──► social/adapter.ts (mock | gerçek) ──► ham yanıt ──► metrics/mappers.ts ──► PostAnalytics
```

- **Bağlama:** `connect` state (CSRF) + PKCE (X, YouTube) üretir, httpOnly/yola kısıtlı/10 dk'lık cookie'ye yazar; `callback` state'i sabit zamanlı karşılaştırır, cookie'yi her durumda siler. İkisi de `proxy.ts` dışındadır, oturumu kendileri doğrular. Panele yalnızca sabit hata kodları döner (`CONNECT_ERROR_CODES`). Koparma bir Server Action'dır (`disconnectSocialAction`); geçmiş metrikler korunur.
- **Token güvenliği:** `lib/services/social/token-crypto.ts` (AES-256-GCM) — veritabanına düz metin token yazılmaz, token'lar asla loglanmaz ve `SocialConnectionView`'a girmez. Süresi 5 dk içinde dolacak token senkronizasyondan önce yenilenir.
- **Senkronizasyon:** kademeli takvim (`metrics/schedule.ts`, 1/6/24/72 sa), "tümünü çek" ile zorlanabilir. **Tetikleme manueldir** — cron/worker eklenmedi (1.10 ruhu); zamanlayıcı gerekirse yalnızca `syncSocialMetrics()`'i çağırır. `PostAnalytics.source`: `MANUAL | API | MOCK` — mock senkronizasyon `MANUAL` kayıtların üzerine yazmaz.
- **Mock modu (`SOCIAL_USE_MOCKS`, 5.2):** OAuth sağlayıcıya gitmeden callback'e döner; metrikler sağlayıcının **ham** biçiminde üretilip gerçek şema/mapper'dan geçer.
- **Gerçek mod durumu:** OAuth kod değişimi ve token yenileme gerçek çağrıdır. Hesap bilgisi ve gönderi metrikleri `adapter.ts` içinde **yer tutucudur** (`NOT_IMPLEMENTED`); çağrılacak uç noktalar orada not edilmiştir. Gerçek senkronizasyon için `SocialPost.providerPostId` dolu olmalıdır.
- **Etkileşim oranı:** (beğeni + yorum + paylaşım + kaydetme) / erişim; erişim yoksa izlenme. Gruplarda toplu oran (toplam etkileşim / toplam kitle) kullanılır.
- **İçerik stratejisi analizi:** gönderiye bağlı `AiContent.renderOptions.selection` (form/gol/xG/H2H) ile etkileşim karşılaştırılır; her grupta < 3 gönderi varsa "az veri" işaretlenir. Nedensellik iddiası taşımaz.

---

## 5. Geliştirici Davranış Kuralları

### 5.1 Kod Yazma Akışı (Her Görev İçin Zorunlu Sıra)

1. **Anla:** İlgili servis katmanı/tip/şema zaten var mı diye önce mevcut kod taranır (`Grep`/`Glob`); var olan bir soyutlama varken yenisi yaratılmaz.
2. **Tiple:** Önce tip/interface tanımlanır (`types/` veya ilgili servisin `types.ts`'i), sonra implementasyon yazılır.
3. **Mock ile geliştir:** Dış API'ye (Sportmonks, API-Football, Fal.ai, Meta/TikTok/YouTube/X) canlı istek atmadan önce `tests/fixtures/` altındaki mock yanıtlarla akış uçtan uca çalıştırılır (bkz. 5.2).
4. **Servis katmanından geç:** Doğrudan `fetch`/SDK çağrısı yerine `lib/services/*` fonksiyonu kullanılır ya da eksikse önce o fonksiyon eklenir.
5. **Görsel doğrulama (render işleri için):** Playwright ile üç format da render edilip incelenir (bkz. 5.3).
6. **Küçük tut:** Tek sorumluluk ilkesine uyulur (bkz. 5.4).
7. **Gerçek çağrıyla doğrula:** Mock ile akış onaylandıktan sonra, kullanıcı onayıyla, gerçek API anahtarlarıyla tek bir örnek üzerinde doğrulama yapılır — kota tüketimi kontrollü tutulur.

### 5.2 Mock Veriyle Test Disiplini

- `tests/fixtures/sportmonks/`, `tests/fixtures/api-football/`, `tests/fixtures/fal/`, `tests/fixtures/meta/` vb. altında, gerçek API yanıt şemasına birebir uyan (ancak kurgusal veri içeren) JSON fixture'lar tutulur.
- Yeni bir servis fonksiyonu yazıldığında, önce ilgili fixture ile birim test yazılır; fixture yoksa önce fixture oluşturulur.
- **Kural:** Geliştirme ve CI ortamında gerçek dış API anahtarları asla varsayılan olarak kullanılmaz; `NODE_ENV=test` veya `USE_MOCKS=true` iken tüm servis katmanı fixture'lardan okuyacak şekilde tasarlanır (servis katmanının `client.ts`'i bu modda mock adaptörüne yönlendirilir).
- Fal.ai render çağrıları özellikle mock'lanır — her geliştirme döngüsünde gerçek görsel üretim tetiklemek hem maliyetli hem yavaştır; render mantığı (prompt builder, katmanlama, format şablonları) mock görsellerle doğrulanır, gerçek Fal.ai çağrısı yalnızca son doğrulama adımında yapılır.

### 5.3 Playwright ile Render Görsel Doğrulaması

- Her render şablonu değişikliğinde, üç format (IG Feed, Story/Reels, X) için Playwright ile ekran görüntüsü alınır ve `tests/visual/` altındaki referans (golden) görsellerle piksel-fark eşiği içinde karşılaştırılır.
- Yeni bir şablon veya katmanlama değişikliği, golden görseller güncellenmeden "tamamlandı" sayılmaz; golden güncellemesi kullanıcı onayı ile yapılır (görsel bir tasarım kararı olduğu için sessizce ezilmez).
- Doğrulanacak asgari kontrol listesi her render için:
  - [ ] 5 katman doğru z-sırasında (bkz. 3.4)
  - [ ] Güvenli alan ihlali yok (platform UI ile çakışma, bkz. 3.3)
  - [ ] CheckMatch.net logosu okunabilir ve sabit konumda
  - [ ] Metin/veri katmanı arka plan üzerinde kontrast eşiğini karşılıyor (WCAG AA görsel eşdeğeri)
  - [ ] Oyuncu kesiminde halo/artefakt yok (bkz. 3.1 adım 4-5 ile tutarlı)

### 5.4 Monolitik Dosya Yazmama Kuralı

- Hiçbir dosya ~300 satırı aşmamalıdır; aşıyorsa sorumluluk ayrıştırması (extract) yapılmadan görev tamamlanmış sayılmaz.
- Bir React bileşeni birden fazla belirgin sorumluluk (veri çekme + karmaşık state + karmaşık render mantığı) taşıyorsa; veri çekme server component'e, state/etkileşim küçük bir client alt bileşenine, karmaşık türetilmiş veri bir `hooks/` fonksiyonuna ayrıştırılır.
- Servis katmanında tek bir `index.ts` dosyasına onlarca fonksiyon yığılmaz; ilişkili fonksiyon grupları (`fixtures.ts`, `teams.ts`, `players.ts`) ayrı dosyalara bölünür ve `index.ts` yalnızca re-export yapar.
- Prompt mühendisliği mantığı (3.2) tek bir dev fonksiyonda değil, blok bazlı küçük saf fonksiyonlara (`buildLightingBlock()`, `buildColorGradeBlock()`, `buildMoodBlock()`) bölünür — her blok bağımsız test edilebilir olmalıdır.
- **Gerekçe:** Küçük, tek sorumluluklu dosyalar hem AI ajanlarının hem insan geliştiricilerin bağlamı doğru anlamasını sağlar; büyük dosyalar hem kod incelemeyi hem de ajan bağlamını bozar.
- **İstisna:** Otomatik üretilen, elle düzenlenmeyen dosyalar (`src/generated/prisma/**`) bu sınırın dışındadır.

### 5.5 Genel Disiplin

- Yeni bir dış bağımlılık (npm paketi, üçüncü parti API) eklemeden önce mevcut yığında (Bölüm 1.1) karşılığı olup olmadığı kontrol edilir; gerekçesiz yeni bağımlılık eklenmez.
- Gizli anahtar veya kimlik bilgisi asla kod içine, commit mesajına veya loglara yazılmaz; sızıntı şüphesi varsa iş durdurulup kullanıcı bilgilendirilir.
- Veritabanı migration'ları (Prisma), Fal.ai canlı render çağrıları, sosyal medya API'lerine gerçek yayın (post) işlemleri gibi geri dönüşü zor/paylaşılan sistemleri etkileyen eylemler öncesinde kullanıcı onayı alınır.
