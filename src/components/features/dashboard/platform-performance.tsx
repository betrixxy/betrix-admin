import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCompactNumber, formatNumber, formatPercent } from "@/lib/dashboard/format";
import { PLATFORM_DOT_CLASS } from "@/lib/dashboard/social-meta";
import { cn } from "@/lib/utils";
import type { PlatformPerformance } from "@/types/social";

export function PlatformPerformanceTable({ platforms }: { platforms: PlatformPerformance[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Platform Performansı</CardTitle>
        <CardDescription>Yayınlanmış gönderilerin platform bazlı toplamı</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Platform</TableHead>
              <TableHead className="text-right">Gönderi</TableHead>
              <TableHead className="text-right">İzlenme</TableHead>
              <TableHead className="text-right">Kaydetme</TableHead>
              <TableHead className="text-right">Etkileşim</TableHead>
              <TableHead className="text-right">Tıklama</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {platforms.map((platform) => (
              <TableRow key={platform.type}>
                <TableCell>
                  <span className="flex items-center gap-2 text-white">
                    <span className={cn("size-2 rounded-full", PLATFORM_DOT_CLASS[platform.type])} />
                    {platform.displayName}
                  </span>
                </TableCell>
                <TableCell className="text-right tabular-nums">{formatNumber(platform.postCount)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatCompactNumber(platform.views)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatCompactNumber(platform.saves)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatPercent(platform.engagementRate)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatNumber(platform.clicks)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
