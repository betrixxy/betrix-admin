# Reels servisi sözleşme v1.2 ihtiyaç listesi

v1.1 listesinin (`contract-v1.1-ihtiyac.md`, form ve kafa kafaya alanları) üstüne yazılır; v1.1 hiç uygulanmadı, ikisi tek seferde v1.2 olarak girebilir. **Bu belge yalnız ihtiyaçtır: Mac'te hiçbir şey değiştirilmedi.** Analist adları `KESIF_RAPORU.md`'den (Mac kapalıyken yazıldı), "doğrula" işaretliler canlı veride görülmedi.

Kural: alan yoksa ya da güvenilir değilse `null` döner, sıfır yazılmaz. İlgili sahne kendini kapatır (`src/story/questions.ts`).

## Market → sözleşme alanı

Sözleşmede **market adı yoktur**: sol sütun yanıtta geçen nötr ad, sağ sütun yalnız Mac tarafındaki kaynak. Yol `src/story/match-data.ts` ile aynıdır. Hepsi 0–1.

| Soru | Sözleşme alanı | Analist adı (`match_analysis.prob_*`) | Not |
|---|---|---|---|
| Kim kazanır? | `outcome.home_win` / `draw` / `away_win` | `home` / `draw` / `away` | v1'de var. |
| {Takım} puanla çıkar mı? | `outcome_double.home_or_draw` / `draw_or_away` | `1x` / `x2` | |
| Rahat bir galibiyet mi? | `comfortable_win.home` | `ah_m15_home` | |
| | `comfortable_win.away` | **`ah_m15_away` raporda yok** | Raporda `ah_p1_away`, `ah_p15_away` var; `ah_p15_away` = 1 − `ah_m15_home`, deplasmanın 2+ farkı değildir. **Doğrula.** Yoksa `null`: deplasman favorisinde sahne kapanır. Motorda eklenecekse ayrı iş. |
| Gollü maç mı? (merdiven) | `goals.two_plus` / `three_plus` / `four_plus` / `five_plus` | `ou15_over` / `ou25_over` / `ou35_over` / `ou45_over` | `three_plus` v1'de var; aynı kaynaktan olduğu **doğrulanacak**. |
| Gollü maç mı? (çubuklar) | `goals.distribution` (0, 1, 2, 3, 4, 5+) | Saklanmıyor. Simülasyonun toplam gol sayımı. | Yeni çıktı; yoksa `null`, çubuklar merdivenden türetilir. `goals_01`, `goals_23`, `goals_4p`, `goals_46`, `goals_7p` **kullanılmaz**, aşağıya bakın. |
| İki takım da gol bulur mu? | `both_score` | `btts_yes` | v1'de var. |
| | `team_goal_chance` | Doğrudan alan yok | v1.1 kararı geçerli: tutarlılık sınanana kadar `null`. |
| {Takım} 2 ve üzeri gol atar mı? | `team_two_plus.home` / `away` | `home_ou15_over` / `away_ou15_over` | |
| {Takım} kalesini gole kapatıp kazanır mı? | `clean_win.home` / `away` | `win_to_nil_home` / `win_to_nil_away` | Örnekte çelişiyor, aşağıya bakın. |
| İlk yarıda kim önde? | `first_half.home` / `draw` / `away` | `ht_home` / `ht_draw` / `ht_away` | |
| İlk yarıda gol çıkar mı? | `first_half.any_goal` / `two_plus` | `ht_ou05_over` / `ht_ou15_over` | |
| Goller hangi yarıda gelir? | `half_most_goals.first` / `second` / `equal` | `1h_more_goals` / `2h_more_goals` / `halves_equal_goals` | |
| Geriden gelip kazanma senaryosu | `comeback.home` / `away` | `ht_ft["2/1"]` / `ht_ft["1/2"]` | Anahtar anlamı **doğrula**: `2/1` = ilk yarıda deplasman önde, maç sonunda ev galip. |
| İlk gol kimden? | `first_goal.home` / `away` / `none` | `first_goal_home` / `_away` / `_none` | v1'de var. |
| Baskı kimde? | `corners.more.home` / `away` / `equal` | `corners_home` / `corners_away` / `corners_equal` | |
| | `corners.nine_plus` / `ten_plus` / `eleven_plus` | `corners_ou85_over` / `ou95` / `ou105` | |
| Sert bir maç mı? | `cards.four_plus` / `five_plus` / `six_plus` | `cards_ou35_over` / `ou45` / `ou55` | Şüpheli, aşağıya bakın. |
| | `cards.red_card` | `red_card` | |
| Penaltı çıkma ihtimali | `penalty` | `penalty` | |
| En olası skor | `score_distribution` + `score_scene_allowed` | `correct_scores` (ilk 10) | v1'de var, karar servisin. |
| Rozet | `model.simulations` | v1'de var | Rozet: `MONTE CARLO · {N} SİMÜLASYON`. |

**Kullanılmayanlar:** `goals_odd`, `goals_even` (analiz değeri yok), `player_goalscorers` (`atgs` matematiksel olarak imkânsız değer veriyor, golcü sahnesi model düzelene kadar kapalı), `season_xg_leaders`, `scorers` (oyuncu verisi artık API-Football'dan; v1.2'de çıkarılabilir), `market_explanations`, `ai_comments`.

## Mac tarafında çözülmesi gerekenler

Video bunları yakalar ve sahneyi kapatır (`src/story/market-checks.ts`), ama kapanan sahne sayısı artarsa video 12 sahneye ulaşamaz. Mevcut örneğe göre şu sahneler kapanırdı:

1. **Gol merdiveni.** `ou15` 0,6885, `ou25` 0,6621 → tam 2 gol %2,6, ama 3 gol %22,8, 4 gol %24,6. Dağılım şekli bozuk: `Gollü maç mı?` ve özet kapanır. `ou35` 0,43 ile `goals_4p` 0,19 da aynı olayın iki değeri. **Çözüm önerisi:** merdiven ve çubuklar tek simülasyon sayımından çıksın (`goals.distribution`).
2. **Gol yemeden kazanma.** `win_to_nil_home` + `win_to_nil_away` = 0,4462, ama iki takımın da gol bulmaması 1 − 0,6549 = 0,3451. İmkânsız. `Kalesini gole kapatıp` sahnesi kapanır.
3. **Kart.** `cards_ou35` = `cards_ou45` = 0,6107, `ou55` 0,5937. `Sert bir maç mı?` kapanır. Nedeni araştırılmadı.
4. **Rozetin doğruluğu.** Rozet her veri sahnesinde "Monte Carlo" diyor. Rapor simülasyonun nerede çalıştığını yazıyor ama **her alanın simülasyondan çıktığını göstermiyor**. Korner, kart, kırmızı kart ve penaltı başka modelden geliyorsa o sahnelerde rozet yanıltıcı olur. **Alan alan doğrulanmalı;** simülasyondan gelmeyen alan için `model.simulated_fields` listesi eklenmeli, rozet ona göre gizlenmeli.
5. **Simülasyon sayısı.** Veritabanında 500.000, sitede "100.000" metni var. Rozet veriden yazar, yani ikisi yan yana görünebilir. Tek değer kararı `checkmatch-faz1` notunda açık.
6. **Takım kimlikleri.** Kadro doğrulaması `teams.*.id` ile API-Football `/players/squads` çağırır. Kimliklerin API-Football kimliği olduğu **doğrulanmalı**; değilse yanlış takımın kadrosu okunur. Rapordaki `team_id 22722` gibi kayıtlar kontrol edilmeli.
7. **Form güvenilirliği.** `checkmatch-faz1` sonrası form alanları düzeldi mi doğrulanmalı (Galatasaray–Stuttgart'ta `WWWLW` ile gerçek `WWWWL`).

## Oyuncu, kadro ve futbol okuması: sözleşmeye girmez

Düello, Rakibine karşı, kadro doğrulaması ve futbol okuması (puan durumu, form, seriler, eksikler, dakika dağılımı) betrix'te API-Football'dan okunur, `ReelSnapshot.context`e yazılır. checkmatch'in oyuncu, kadro ve puan durumu verisi kullanılmaz. Sözleşmeden yalnız olasılıklar gelir. **"Nasıl hesapladık?" sahnesi kaldırıldı (2026-11-03): `model_inputs` artık gerekmiyor.**

## Sözleşme disiplini

- v1 `strictObject`: önce betrix şeması iki sürümü kabul eder, sonra servis yükselir. `form` nesneye dönüştüğü için kırıcıdır, sürüm artar.
- Yeni metinler `contentLanguageGate`'ten geçer. Alan adlarında `ou25`, `btts`, `ah_` gibi adlar dışarı çıkmaz.
- `score_scene_allowed` servisin kararıdır. Yeni tutarlılık denetimleri video tarafındadır; aynıları servise de eklenirse sorun yayından önce görünür.
- `quality.checks` listesine eleman eklemek şekli değiştirmez, ama betrix bilinmeyen kontrol adını nasıl karşılıyor doğrulanmalı.
