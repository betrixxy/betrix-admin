import type { Metadata } from "next";
import Link from "next/link";
import { PersonNameFix, TeamColorFix, VenueNameFix } from "@/components/features/archive/name-fix-form";
import { listAutoTeamColors } from "@/lib/dashboard/team-colors";
import { PageHeader } from "@/components/features/dashboard/page-header";
import { accentReport, personReport, venueReport } from "@/lib/names/name-report";

export const metadata: Metadata = {
  title: "Ad Raporu — betrix.pro",
  description: "Türkçe karakter içermesi muhtemel ASCII kişi adları, aksanı şüpheli adlar ve Türkçe karşılığı olmayan stadyumlar",
};

// Arşiv ve Sportmonks canlı okunur (bkz. CLAUDE.md 1.5).
export const dynamic = "force-dynamic";

const ROLE_LABEL = { PLAYER: "Oyuncu", COACH: "Teknik direktör" } as const;

export default async function NameReportPage() {
  const [people, accents, venues, colors] = await Promise.all([personReport(), accentReport(), venueReport(), listAutoTeamColors()]);
  return (
    <>
      <PageHeader
        title="Ad Raporu"
        description="Kartlardaki kişi ve stadyum adları için düzeltme listesi. Kişi adı önceliği: buradaki düzeltme → Sportmonks adı (Türkçe karakterli) → API adı. Öneri Sportmonks'tan; kaydedilen ad bütün kartlarda kullanılır."
      />
      <p className="mb-4 text-xs text-muted-foreground">
        Kapsam: arşivdeki Süper Lig takımları (Sportmonks kadrosu, 24 saat önbellekli) ve önümüzdeki 7 günün Türk takımlı maçlarının stadyumları.{" "}
        <Link href="/dashboard/library" className="text-emerald-400 hover:underline">
          Kütüphaneye dön
        </Link>
      </p>

      <section className="mb-8 flex flex-col gap-2">
        <h2 className="text-sm font-medium">Kişiler · {people.length} ad</h2>
        {people.length === 0 ? (
          <p className="text-sm text-muted-foreground">Düzeltilecek ASCII Türk adı yok.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr>
                <th className="py-1.5 pr-3 font-medium">Takım</th>
                <th className="py-1.5 pr-3 font-medium">Rol</th>
                <th className="py-1.5 pr-3 font-medium">Şu anki ad</th>
                <th className="py-1.5 font-medium">Düzeltme (öneri Sportmonks)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {people.map((row) => (
                <tr key={row.personId}>
                  <td className="py-1.5 pr-3 text-muted-foreground">{row.teamName}</td>
                  <td className="py-1.5 pr-3 text-xs text-muted-foreground">{ROLE_LABEL[row.role]}</td>
                  <td className="py-1.5 pr-3">
                    {row.current}
                    {row.suggestion ? null : <span className="block text-[11px] text-amber-300">Sportmonks&apos;ta bulunamadı — elle kontrol edin</span>}
                  </td>
                  <td className="py-1.5">
                    <PersonNameFix personId={row.personId} suggestion={row.suggestion ?? row.current} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="mb-8 flex flex-col gap-2">
        <h2 className="text-sm font-medium">Aksan şüpheli · {accents.length} ad</h2>
        <p className="text-xs text-muted-foreground">
          API bazı adları yanlış aksanla verir (ör. &quot;Cissè&quot;: Fransızca/Batı Afrika adlarında sözcük sonu genelde &quot;é&quot;). Otomatik
          düzeltilmez; doğruysa olduğu gibi bırakın. Kaynak: arşivdeki kişiler ve son 30 günün Maç Sonucu kartları.
        </p>
        {accents.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aksanı şüpheli ad yok.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr>
                <th className="py-1.5 pr-3 font-medium">Şu anki ad</th>
                <th className="py-1.5 pr-3 font-medium">Görüldüğü yer</th>
                <th className="py-1.5 font-medium">Öneri / düzeltme</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {accents.map((row) => (
                <tr key={row.name}>
                  <td className="py-1.5 pr-3">{row.name}</td>
                  <td className="py-1.5 pr-3 text-xs text-muted-foreground">{row.sources.join(" · ")}</td>
                  <td className="py-1.5">
                    {row.personId ? (
                      <PersonNameFix personId={row.personId} suggestion={row.suggestion} />
                    ) : (
                      <span className="text-xs">
                        {row.suggestion}
                        <span className="block text-[11px] text-amber-300">Arşivde yok — kişiyi arşive ekleyip adını buradan düzeltin (kartlar arşiv adını kullanır).</span>
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium">Stadyumlar · {venues.length} eşleşmeyen</h2>
        {venues.length === 0 ? (
          <p className="text-sm text-muted-foreground">Bütün stadyumların Türkçe karşılığı ya da düzeltmesi var.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr>
                <th className="py-1.5 pr-3 font-medium">API adı</th>
                <th className="py-1.5 pr-3 font-medium">Maçlar</th>
                <th className="py-1.5 font-medium">Kart adı</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {venues.map((row) => (
                <tr key={row.apiName}>
                  <td className="py-1.5 pr-3">{row.apiName}</td>
                  <td className="py-1.5 pr-3 text-xs text-muted-foreground">{row.matches.join(" · ")}</td>
                  <td className="py-1.5">
                    <VenueNameFix apiName={row.apiName} suggestion={row.current} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="mt-8 flex flex-col gap-2">
        <h2 className="text-sm font-medium">Otomatik renkler · {colors.length} onay bekliyor</h2>
        <p className="text-xs text-muted-foreground">
          Kulüp renk tablosunda olmayan takımların rengi logodan çıkarıldı (koyu zeminde okunurluk kuralıyla) ve kartlarda şimdiden kullanılıyor. Onaylanan renk tablo gibi kullanılır; düzeltmek için rengi değiştirip onaylayın.
        </p>
        {colors.length === 0 ? (
          <p className="text-sm text-muted-foreground">Onay bekleyen otomatik renk yok.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr>
                <th className="py-1.5 pr-3 font-medium">Takım</th>
                <th className="py-1.5 pr-3 font-medium">Logo</th>
                <th className="py-1.5 pr-3 font-medium">Çıkarılan</th>
                <th className="py-1.5 font-medium">Onay (birincil · ikincil)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {colors.map((row) => (
                <tr key={row.teamId}>
                  <td className="py-1.5 pr-3">
                    {row.teamName} <span className="text-xs text-muted-foreground">#{row.teamId}</span>
                  </td>
                  <td className="py-1.5 pr-3">
                    {/* eslint-disable-next-line @next/next/no-img-element -- sağlayıcı logosu, küçük önizleme */}
                    {row.logoUrl ? <img src={row.logoUrl} alt="" width={28} height={28} className="size-7 object-contain" /> : null}
                  </td>
                  <td className="py-1.5 pr-3 font-mono text-xs">
                    <span className="mr-1 inline-block size-3 rounded-sm align-middle" style={{ backgroundColor: row.primary }} />
                    {row.primary} · <span className="mr-1 inline-block size-3 rounded-sm align-middle" style={{ backgroundColor: row.secondary }} />
                    {row.secondary}
                  </td>
                  <td className="py-1.5">
                    <TeamColorFix teamId={row.teamId} primary={row.primary} secondary={row.secondary} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
