import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { RecentVisit } from "@/types/traffic";

export function RecentVisitsTable({ visits }: { visits: RecentVisit[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Son Ziyaretler</CardTitle>
        <CardDescription>En yeni {visits.length} kayıt · IP adresleri KVKK gereği maskelenir</CardDescription>
      </CardHeader>
      <CardContent>
        {visits.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Henüz trafik kaydı yok. checkmatch.net ziyaretleri TrafficLog tablosuna yazıldığında burada görünür.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Zaman</TableHead>
                <TableHead>Sayfa</TableHead>
                <TableHead>Kaynak</TableHead>
                <TableHead>Oturum</TableHead>
                <TableHead>IP</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {visits.map((visit) => (
                <TableRow key={visit.id}>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {format(new Date(visit.visitedAt), "d MMM, HH:mm:ss", { locale: tr })}
                  </TableCell>
                  <TableCell className="max-w-56 truncate text-white">{visit.path}</TableCell>
                  <TableCell>{visit.sourceLabel}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{visit.sessionShort ?? "—"}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{visit.maskedIp ?? "—"}</TableCell>
                  <TableCell>{visit.isUniqueVisit ? <Badge variant="outline">Tekil</Badge> : null}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
