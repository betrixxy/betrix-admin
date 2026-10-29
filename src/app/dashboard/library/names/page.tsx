import type { Metadata } from "next";
import Link from "next/link";
import { PersonNameFix, VenueNameFix } from "@/components/features/archive/name-fix-form";
import { PageHeader } from "@/components/features/dashboard/page-header";
import { personReport, venueReport } from "@/lib/names/name-report";

export const metadata: Metadata = {
  title: "Ad Raporu — betrix.pro",
  description: "Türkçe karakter içermesi muhtemel ASCII kişi adları ve Türkçe karşılığı olmayan stadyumlar",
};

// Arşiv ve Sportmonks canlı okunur (bkz. CLAUDE.md 1.5).
export const dynamic = "force-dynamic";

const ROLE_LABEL = { PLAYER: "Oyuncu", COACH: "Teknik direktör" } as const;

export default async function NameReportPage() {
  const [people, venues] = await Promise.all([personReport(), venueReport()]);
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
    </>
  );
}
