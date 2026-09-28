import Link from "next/link";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { Megaphone } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AD_PLATFORM_META, AD_PLATFORM_ORDER } from "@/lib/calendar/ad-platform";
import { formatAdSpend } from "@/lib/calendar/ad-spend";
import type { AdBudgetOverview } from "@/lib/dashboard/ad-budget-data";

interface AdBudgetPanelProps {
  overview: AdBudgetOverview;
  fixtureLabels: Record<string, string>;
}

function costLabel(value: number | null): string {
  return value === null ? "—" : `${value.toLocaleString("tr-TR", { maximumFractionDigits: 2 })} ₺`;
}

/** Takvimde girilen maç başına reklam bütçeleri + takip linkiyle gelen ziyaret başına maliyet. */
export function AdBudgetPanel({ overview, fixtureLabels }: AdBudgetPanelProps) {
  const { rows, totalsByPlatform, grandTotal, attributedVisits, costPerVisit } = overview;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Megaphone className="size-4 text-amber-400" />
          Reklam Bütçeleri
        </CardTitle>
        <CardDescription>
          Fikstür CRM&apos;de maç başına girilen planlanan bütçe. Ziyaretler, o maçın gönderilerindeki takip linkinden gelir.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Henüz reklam bütçesi girilmedi —{" "}
            <Link href="/calendar" className="text-emerald-400 hover:underline">
              Fikstür CRM
            </Link>
            &apos;de bir maça tıklayıp bütçe kaydedin.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
              <div className="flex flex-col rounded-lg bg-muted/30 p-3">
                <span className="text-[11px] text-muted-foreground">Toplam bütçe</span>
                <span className="text-lg font-semibold text-white">{formatAdSpend(grandTotal)}</span>
              </div>
              {AD_PLATFORM_ORDER.map((platform) => (
                <div key={platform} className="flex flex-col rounded-lg bg-muted/30 p-3">
                  <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <span className="size-2 rounded-full" style={{ backgroundColor: AD_PLATFORM_META[platform].colorHex }} />
                    {AD_PLATFORM_META[platform].label}
                  </span>
                  <span className="text-lg font-semibold text-white">{formatAdSpend(totalsByPlatform[platform])}</span>
                </div>
              ))}
              <div className="flex flex-col rounded-lg bg-muted/30 p-3">
                <span className="text-[11px] text-muted-foreground">Ziyaret başı maliyet</span>
                <span className="text-lg font-semibold text-white">{costLabel(costPerVisit)}</span>
                <span className="text-[10px] text-muted-foreground">{attributedVisits} atfedilen ziyaret</span>
              </div>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Maç</TableHead>
                  <TableHead>Yayın</TableHead>
                  <TableHead>Platformlar</TableHead>
                  <TableHead className="text-right">Toplam</TableHead>
                  <TableHead className="text-right">Ziyaret</TableHead>
                  <TableHead className="text-right">Maliyet / ziyaret</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.fixtureId}>
                    <TableCell className="max-w-[16rem] truncate text-white">
                      <Link href={`/calendar?month=${row.scheduledFor.slice(0, 7)}`} className="hover:underline">
                        {fixtureLabels[row.fixtureId] ?? row.fixtureId}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(row.scheduledFor), "d MMM", { locale: tr })}
                    </TableCell>
                    <TableCell>
                      <span className="flex flex-wrap gap-1.5">
                        {AD_PLATFORM_ORDER.filter((platform) => row.spend[platform]).map((platform) => (
                          <span key={platform} className="flex items-center gap-1 text-[11px] text-muted-foreground">
                            <span className="size-1.5 rounded-full" style={{ backgroundColor: AD_PLATFORM_META[platform].colorHex }} />
                            {formatAdSpend(row.spend[platform] ?? 0)}
                          </span>
                        ))}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-medium text-white tabular-nums">{formatAdSpend(row.total)}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.attributedVisits}</TableCell>
                    <TableCell className="text-right tabular-nums">{costLabel(row.costPerVisit)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        )}
      </CardContent>
    </Card>
  );
}
