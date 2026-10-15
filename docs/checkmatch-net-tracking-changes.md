# checkmatch.net izleme kodu: yapılması gereken değişiklikler

> Bu not checkmatch.net projesine (Mac sunucusu) uygulanacak. Panel tarafı (betrix-studio) hazır.
> Kaynak: `src/lib/dashboard/tracker-snippet.ts` · uç nokta: `POST /api/track` · kural: `CLAUDE.md` §4.3

## 1. Mevcut durum: snippet tam URL'yi göndermiyor

Paneldeki izleme kodu **sorgu dizesini bilinçli olarak göndermiyor**. Gönderilen yük şu kadar:

```json
{ "path": "<location.pathname>", "sessionId": "<cm_vid>", "postId": "<cm_post varsa>" }
```

Bunun iki sonucu var:

- `utm_source`, `utm_medium`, `utm_campaign` ve `utm_content` panele **hiç ulaşmıyor**. TrafficLog'da UTM bilgisi yok.
- Gönderiye atıf yalnızca `cm_post` parametresiyle çalışıyor. Bu da yalnızca eski takvim linklerinde vardı.

Bu tespit koddan yapıldı. Prod veritabanındaki TrafficLog kayıtlarını bu oturumda okuyamadım. checkmatch.net'teki kod sonradan elle değiştirildiyse aşağıdaki sorgu gerçek durumu gösterir. `path` alanında `?` geçen kayıt varsa site sorgu dizesini de gönderiyor demektir:

```sql
SELECT count(*) FILTER (WHERE path LIKE '%?%') AS with_query, count(*) AS total FROM "TrafficLog";
```

Kısa linkler hedef URL'ye geriye dönük uyumluluk için `cm_post=<SocialPost.id>` de ekliyor. Bu sayede **eski snippet bile gönderi atfını yakalar**, ama UTM sütunları boş kalır. Yeni snippet yüklenince ikisi de dolar.

## 2. Yapılacak değişiklik: izleme kodunu yenisiyle değiştirmek

Panel deploy edildikten sonra şu adımları izleyin:

1. Panelde **Web Trafiği** sayfasını açın. "İzleme kodu" kartındaki güncel kodu kopyalayın. Bu kod `buildTrackerSnippet` tarafından üretilir.
2. checkmatch.net'te eski `<!-- CheckMatch trafik takibi (betrix.pro Studio) -->` bloğunu bu yeni kodla **tamamen değiştirin**. Yer aynı kalır: `</body>`'den hemen önce, tüm sayfalarda.
3. Başka bir değişiklik gerekmez. Uç nokta, site anahtarı (`TRACK_SITE_KEY`) ve CORS ayarı aynı.

Yeni kodun eskisinden farkları:

| Konu | Eski | Yeni |
|---|---|---|
| Ziyaretçi kimliği (`cm_vid`, localStorage) | var | var (değişmedi) |
| Oturum kimliği (`cm_sid`, sessionStorage, 30 dk hareketsizlikte yenilenir) | **yok** | `visitId` olarak gönderilir |
| `utm_*` parametreleri | gönderilmiyor | giriş sayfasında `utm: { source, medium, campaign, content, term }` |
| Gönderi atfı | `cm_post` | `cm_post` **veya** kısa linkin `utm_content` (= SocialPost.id) |
| Sorgu dizesinin geri kalanı | gönderilmiyor | gönderilmiyor (olası kişisel veri) |

Yeni yük:

```json
{
  "path": "/mac/galatasaray-fenerbahce",
  "sessionId": "c1f0…",
  "visitId": "9ab2…",
  "postId": "cmg1x…",
  "utm": { "source": "x", "medium": "social", "campaign": "match_day", "content": "cmg1x…" }
}
```

Elle entegrasyon yapılıyorsa (snippet kopyalanmıyorsa) asgari şartlar şunlar:

- `visitId`: sekme oturumu başına bir UUID. sessionStorage'da tutulur, son etkinlikten 30 dk sonra yenilenir.
- `utm`: URL'deki `utm_*` değerleri. **Yalnızca giriş sayfasında** gönderilir. Sonraki sayfa görüntülemeleri atfı sunucuda aynı `visitId`'nin ilk ziyaretinden devralır.
- `utm.content` dolu ve `cm_post` yoksa `postId` = `utm.content` olur.

## 3. Geri dönen ziyaretçi ölçümü

Geri dönen ziyaretçinin asıl kaynağı **snippet'teki kalıcı ziyaretçi kimliği** `cm_vid`. Bu kimlik localStorage'da tutulur ve API'ye `sessionId` adıyla gider.

- Kimlik **eski snippet'te zaten var ve çalışıyor**. Bir kimliğin ilk görülmesi `isUniqueVisit = true`, daha sonraki ziyaretleri geri dönüştür.
- Oturum sayısı yeni `visitId` (`cm_sid`) ile ölçülür. Eski snippet'te bu alan yok. O durumda aynı ziyaretçinin 30 dk içindeki ziyaretleri tek oturum sayılır.
- IP adresi ziyaretçi tespiti için kullanılmaz. Panel IP'yi yalnızca sabit anahtarlı HMAC özeti olarak saklar ve özeti hız sınırı ile kaba bot ayıklaması için kullanır. Ham IP hiçbir yerde tutulmaz.

## 4. Kontrol

1. Yeni kod yüklendikten sonra şu adresi açın: `https://checkmatch.net/?utm_source=x&utm_medium=social&utm_campaign=test&utm_content=test`
2. Panelde **Web Trafiği → Son ziyaretler** listesinde kaydı görün.
3. Aynı sekmede başka bir sayfaya geçin. O kayıt da aynı oturumdan UTM'i devralır (`attributionInherited = true`).
4. Tarayıcı geliştirici araçlarında `/api/track` isteğinin gövdesinde `visitId` ve `utm` alanları olmalı.

CSP kullanılıyorsa `connect-src` içinde panel alan adı (`https://www.betrix.pro`) zaten izinli olmalı. Uç nokta değişmedi.
