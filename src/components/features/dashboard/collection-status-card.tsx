import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { tr } from "date-fns/locale";
import { AlertTriangle, CheckCircle2, FileDown } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { AccountSummary } from "@/lib/dashboard/account-data";
import { formatNumber } from "@/lib/dashboard/format";
import { PLATFORM_LABELS } from "@/lib/dashboard/social-meta";
import type { CollectionStatus } from "@/lib/metrics/status";
import { RetryJobsButton } from "./retry-jobs-button";

const JOB_LABELS: Record<string, string> = {
  POST_METRICS: "Gönderi metrikleri",
  ACCOUNT_DAILY: "Günlük hesap metrikleri",
  AUDIENCE_WEEKLY: "Haftalık demografi",
  ACCOUNT_BACKFILL: "Geriye dönük doldurma",
};

function Warning({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
      <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex flex-col rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className="text-lg font-semibold text-white tabular-nums">{value}</span>
      {hint ? <span className="text-[11px] text-muted-foreground">{hint}</span> : null}
    </div>
  );
}

/** Otomatik veri toplamanın durumu: son çekim, bekleyen/başarısız işler, X kredi sınırı, token uyarıları. */
export function CollectionStatusCard({ status, summaries }: { status: CollectionStatus; summaries: AccountSummary[] }) {
  const last = status.lastSuccessAt
    ? `Son başarılı çekim ${formatDistanceToNow(new Date(status.lastSuccessAt), { locale: tr, addSuffix: true })}.`
    : "Henüz başarılı otomatik çekim yok.";
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <CardTitle>Veri toplama durumu</CardTitle>
          <CardDescription>Metrikler saatlik otomatik okunur (paylaşım her zaman elle). {last}</CardDescription>
        </div>
        <a href="/dashboard/analytics/export-account" download className={buttonVariants({ variant: "outline", size: "sm" })}>
          <FileDown className="size-3.5" />
          Hesap verisi (CSV)
        </a>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        {status.connectionWarnings.map(({ platform, accountName, warning }) => (
          <Warning key={platform}>
            {PLATFORM_LABELS[platform]}
            {accountName ? ` (@${accountName})` : ""}:{" "}
            {warning.level === "expired"
              ? "erişim izninin süresi doldu, veri toplama durdu. Hesabı aşağıdan yeniden bağlayın."
              : `erişim izni ${warning.daysLeft} gün içinde bitiyor. Kesinti olmaması için hesabı yeniden bağlayın.`}
          </Warning>
        ))}
        {status.xLimitReached || status.deferredByBudget > 0 ? (
          <Warning>
            Günlük X okuma sınırına ulaşıldı ({formatNumber(status.xUsage.posts)} / {formatNumber(status.xUsage.limit)}, X_DAILY_READ_LIMIT).{" "}
            {formatNumber(status.deferredByBudget)} iş ertesi güne (UTC) ertelendi.
          </Warning>
        ) : null}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {summaries.map((summary) => (
            <Tile
              key={summary.platform}
              label={`${PLATFORM_LABELS[summary.platform]} takipçi`}
              value={summary.followers === null ? "—" : formatNumber(summary.followers)}
              hint={summary.growth30 === null ? "30 gün: veri birikiyor" : `30 gün: ${summary.growth30 >= 0 ? "+" : ""}${formatNumber(summary.growth30)}`}
            />
          ))}
          <Tile label="Bekleyen iş" value={formatNumber(status.pending)} />
          <Tile label="X okuma (bugün, UTC)" value={`${formatNumber(status.xUsage.posts)} / ${formatNumber(status.xUsage.limit)}`} />
        </div>

        {status.issues.length === 0 ? (
          <p className="flex items-center gap-1.5 text-xs text-emerald-400">
            <CheckCircle2 className="size-3.5" />
            Başarısız ya da durdurulmuş iş yok.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            <span className="text-xs text-muted-foreground">
              {formatNumber(status.failedCount)} başarısız · {formatNumber(status.blockedCount)} durduruldu (token/bağlantı sorunu; hesap yeniden bağlanınca kendiliğinden devam eder)
            </span>
            <ul className="flex flex-col gap-1 text-xs">
              {status.issues.map((issue) => (
                <li key={issue.id} className="flex flex-wrap gap-x-2 border-b border-white/5 pb-1">
                  <span className={issue.status === "BLOCKED" ? "text-amber-300" : "text-destructive"}>{issue.status === "BLOCKED" ? "Durduruldu" : "Başarısız"}</span>
                  <span className="text-white">{JOB_LABELS[issue.kind] ?? issue.kind}</span>
                  {issue.kind === "POST_METRICS" ? (
                    <Link href={`/dashboard/posts/${issue.target}`} className="text-muted-foreground underline">
                      gönderi
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">{issue.platform ? PLATFORM_LABELS[issue.platform] : issue.target}</span>
                  )}
                  <span className="text-muted-foreground">{issue.lastError ?? ""}</span>
                </li>
              ))}
            </ul>
            {status.failedCount > 0 ? <RetryJobsButton /> : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
