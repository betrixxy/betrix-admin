# Reels servisi sözleşme v1.1 ihtiyaç listesi

Mac açılınca uygulanacak. Kaynaklar `KESIF_RAPORU.md` ve v1 şemasıdır (`src/lib/services/reels-schema.ts`). Mac kapalıyken yazıldı: **"doğrula" işaretli maddeler canlı veride görülmedi.**

Kural: alan yoksa ya da güvenilir değilse `null` döner, sıfır yazılmaz. İlgili sahne kendini kapatır (`src/story/pool.ts`).

## Eklenecek alanlar

Yol `src/story/match-data.ts` ile aynıdır.

| Alan | Sahne | Kaynak | Durum |
|---|---|---|---|
| `match.venue` | 1 | `matches.venue_id` → `venues.name` | **Doğrula:** rapordaki örnek satırda ad ve şehir yer değiştirmiş, örnek maçta `venue_id` boş. Şüpheli değer `null`. |
| `teams.*.short_name` | HUD, tablolar | `teams.short_name` | Doluluk oranı doğrulanacak. Boşsa betrix `team-short-names.ts` kuralı. |
| `form.*.last5` | 4 | `match_analysis.home_form` / `away_form`, `form` (10 harf) | **Doğrula:** harf sırası (en yeni başta mı). Sözleşmede en yeni başta olmalı. v1'deki `form` düz metin, v1.1'de nesne olur: **kırıcı değişiklik**, sürüm artar. |
| `form.*.goals_for`, `goals_against`, `xg_for`, `xg_against` | 4, 7, 8, 16 | `home_form` / `away_form` JSON ortalamaları, `home_xg_avg` / `away_xg_avg` | Rapor gol ve xG ortalamalarının var olduğunu yazıyor. Yediği gol ve xG aleyhine alanları **doğrulanacak**. Kaç maçlık pencere olduğu da. |
| `form.*.btts_rate` | Şu an sahnede yok | `home_form` / `away_form` JSON | Rapor var diyor. |
| `form.*.clean_sheet_rate` | 4, 7, 9 | **Raporda geçmiyor.** | Yoksa son maçlardan hesaplanır (`matches`: rakibin golü 0). Hesap pencereyle aynı maçlardan yapılmalı. |
| `form.*.euro_fatigue_days` | 11 | **Raporda geçmiyor.** Motorda `manager_games` gibi özellikler var, bu alan aranacak. | **Doğrula.** Yoksa `matches`: Avrupa kupası liglerinde son maçtan bu yana gün. Avrupa'da oynamayan takım için 99 yerine `null` daha temiz; `pool.ts` ikisini de karşılar. |
| `team_goal_chance` | 9 | Doğrudan alan yok. | Skor dağılımı ilk 10 skorla sınırlı, oradan güvenle çıkmaz. `1 − e^(−λ)` (`home_lambda` / `away_lambda`) yayınlanan rakamlarla tutmayabilir (rapor bu alanların tutarsızlığını belgeliyor). **Tutarlılık sınanana kadar `null`:** sahne tek gauge + gol yememe oranına düşer. |
| `h2h.matches[]` (tarih, ev, deplasman, skor) | 5 | `match_analysis.h2h_summary` maç listesi (`h2h` tablosu boş) | Rapor listenin var olduğunu yazıyor, biçim doğrulanacak. En yeni başta. |
| `h2h.avg_goals` | 5, 8, 16 | `h2h_summary` | Yoksa listeden hesaplanır; `played` ile aynı maçlardan olmalı. |
| `h2h.home_wins` / `away_wins` | 5 | `h2h_summary` | **Doğrula:** "ev" bugünkü ev sahibi takım mı, o maçın ev sahibi mi? Kart bugünkü takımlara göre yazıyor; ikincisiyse yanlış olur. |
| `model.simulations` | 3, güvenilirlik satırı | v1'de var | Değişiklik yok. |
| `model_track_record[]` (`from`, `to`, `matches`, `hit_rate`) | 14 | `prediction_accuracy` (market, predicted, outcome, model_ver, recorded_at) | Aşağıdaki iki koşul sağlanmadan **açılmaz.** |

## Modelin karnesi: açılmadan önce çözülmesi gereken iki konu

1. **"Yalnız başlama öncesi" koşulu şu an kanıtlı değil.** `match_analysis` tek satırdır, üzerine yazılır, geçmiş sürüm tutulmaz. `prediction_accuracy` gece denetiminde yazılıyor (`scripts/nightly_audit.py:197`); `recorded_at` hesabın değil kaydın zamanı olabilir. Yazılan `predicted` değerinin başlama anından önce hesaplandığı kanıtlanamazsa satır karneye girmez. Kanıt için hesap zamanı (`computed_at`) `matches.kickoff_utc` ile karşılaştırılmalı. Bu alan yoksa önce o eklenmeli ve karne yalnız o tarihten sonraki maçlardan çalışmalı. Bu çözülmezse sahne kapalı kalır.
2. **Kova hesabı henüz yok.** Raporda yalnız ortalama tahmin / gerçekleşen tablosu var, "kova bazlı kalibrasyon değildir" notuyla. Sonuç marketleri (`result_home`, `result_draw`, `result_away`) ayrı ayrı kovalanacak. Kapsam 2026-04-11'den itibaren, maç başına üç satır. Beraberlik kalibrasyonu sorunu belgeli (`MODEL-KARSILASTIRMA.md`), kovalara karıştırılmadan önce bakılmalı.

Eşik: kovada en az 30 maç (`pool.ts`). Bu örnekteki sayılar **kurgusaldır**, gerçek isabeti göstermez.

## Sözleşme disiplini

- v1 `strictObject`: yeni alan betrix tarafında şema güncellenmeden hata verir. Önce betrix şeması (iki sürümü de kabul eden geçiş), sonra servis.
- Yeni metinler `contentLanguageGate`'ten geçer. Alan adlarında `ou25`, `btts` gibi market adları dışarı çıkmaz. Yukarıdaki `btts_rate` sözleşmeye `both_score_rate` adıyla girmeli; sahneye bağlanırken `match-data.ts` de aynı ada geçer.
- `season_xg_fresh` ve `score_scene_allowed` servisin kararıdır, video tarafı yeniden hesaplamaz.
- Takım renkleri checkmatch'te yok, betrix'te (`TeamColor`, `club-colors.ts`): sözleşmeye girmez, senaryo motoru betrix'te ekler. Benzer renkli iki takımda ayrışma kuralı da orada (`color-math.ts`).
