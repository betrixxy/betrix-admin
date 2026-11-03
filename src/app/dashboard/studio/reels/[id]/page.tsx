import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowLeft, Check, Minus, X } from "lucide-react";
import { PageHeader } from "@/components/features/dashboard/page-header";
import { CancelProjectButton, FreezeButton } from "@/components/features/dashboard/reels-action-buttons";
import { ReelsAnalystNote } from "@/components/features/dashboard/reels-analyst-note";
import { ReelsSnapshotCard } from "@/components/features/dashboard/reels-snapshot-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { competitionShortName } from "@/lib/names/competition-names";
import { prisma } from "@/lib/prisma";
import { formatIstanbulDateTime, formatPublishWindow, publishWindowState } from "@/lib/reels/publish-window";
import { groupReelChecks, reelCheckLabel, REEL_SCENE_IDS, REEL_SCENE_LABELS, type ReelSceneAvailability } from "@/lib/reels/scenes";
import { canCancelReel, canFreezeReel, REEL_STATUS_LABELS } from "@/lib/reels/selection";
import { reelSnapshotView } from "@/lib/reels/snapshot-view";
import { reelSquadStatus } from "@/lib/reels/squad-rule";
import { reelsMatchDetailSchema, type ReelsCheck } from "@/lib/services/reels-schema";

export const metadata: Metadata = { title: "Reels projesi — betrix.pro" };

export const dynamic = "force-dynamic";

function Mark({ ok }: { ok: boolean }) {
  return ok ? <Check className="size-4 shrink-0 text-emerald-300" /> : <X className="size-4 shrink-0 text-amber-300" />;
}

function CheckList({ checks, muted = false }: { checks: ReelsCheck[]; muted?: boolean }) {
  return (
    <ul className="flex flex-col gap-1.5 text-sm">
      {checks.map((check) => (
        <li key={check.name} className="flex items-start gap-2">
          {muted ? (
            check.ok ? <Check className="size-4 shrink-0 text-muted-foreground" /> : <Minus className="size-4 shrink-0 text-muted-foreground" />
          ) : (
            <Mark ok={check.ok} />
          )}
          <span className={muted ? "text-muted-foreground" : "text-white"}>{reelCheckLabel(check.name)}</span>
        </li>
      ))}
    </ul>
  );
}

function SubHeading({ children }: { children: React.ReactNode }) {
  return <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{children}</h3>;
}

export default async function ReelProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await prisma.reelProject.findUnique({
    where: { id },
    include: { snapshots: { orderBy: { version: "desc" } } },
  });
  if (!project) notFound();

  const now = new Date();
  const window = { publishFrom: project.publishFrom, publishTo: project.publishTo };
  const latest = project.snapshots[0];
  const availability = latest ? (latest.sceneAvailability as unknown as ReelSceneAvailability) : null;
  const stored = latest ? reelsMatchDetailSchema.safeParse(latest.payload) : null;
  const detail = stored?.success ? stored.data : null;
  const groups = detail ? groupReelChecks(detail) : null;
  const squad = latest ? reelSquadStatus(latest.squadCheckedAt, now, formatIstanbulDateTime) : null;
  const freezeBlocked = canFreezeReel(project.status)
    ? null
    : project.status === "CANCELLED"
      ? "İptal edilen proje için yeniden seçin."
      : "Onaydan sonra yeni veri dondurulamaz.";

  return (
    <>
      <Link href="/dashboard/studio/reels" className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-white">
        <ArrowLeft className="size-4" />
        Reels Stüdyo
      </Link>
      <PageHeader
        title={`${project.homeName} – ${project.awayName}`}
        description={`${competitionShortName(project.leagueId, project.leagueName)} · ${formatIstanbulDateTime(project.kickoffUtc)} (İstanbul)`}
        actions={
          <div className="flex flex-wrap items-start gap-2">
            {canCancelReel(project.status) ? <CancelProjectButton projectId={project.id} /> : null}
            <FreezeButton projectId={project.id} hasSnapshot={latest !== undefined} disabledReason={freezeBlocked} />
          </div>
        }
      />
      <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
        <Badge variant="secondary">{REEL_STATUS_LABELS[project.status]}</Badge>
        <span>Yayın penceresi {formatPublishWindow(window)}</span>
        <span>{publishWindowState(window, now).label}</span>
      </div>

      {availability?.warnings.map((warning) => (
        <div key={warning} className="flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>{warning}</span>
        </div>
      ))}

      {squad && !squad.ok ? (
        <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>{squad.text}</span>
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Analist notu</CardTitle>
          <CardDescription>Kendi futbol okumanız: &quot;Maçın anahtarı&quot; ve &quot;checkmatch senaryosu&quot; kartlarına girer. Yazmazsanız veri tabanlı yorum kullanılır.</CardDescription>
        </CardHeader>
        <CardContent>
          <ReelsAnalystNote projectId={project.id} note={project.analystNote} disabledReason={canFreezeReel(project.status) ? null : "Bu aşamada not değiştirilemez."} />
        </CardContent>
      </Card>

      {!latest || !availability ? (
        <Card>
          <CardHeader>
            <CardTitle>Veri henüz dondurulmadı</CardTitle>
            <CardDescription>Veriyi dondur düğmesi model çıktısının o anki hâlini kaydeder.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <>
          {detail ? <ReelsSnapshotCard view={reelSnapshotView(detail)} /> : null}
          <Card>
            <CardHeader>
              <CardTitle>Sürüm {latest.version}</CardTitle>
              <CardDescription>
                Model {latest.modelVersion} · hesap {formatIstanbulDateTime(latest.computedAt)} · simülasyon {detail?.model.simulations?.toLocaleString("tr-TR") ?? "yok"} · donduruldu {formatIstanbulDateTime(latest.fetchedAt)}{squad?.ok ? ` · ${squad.text}` : ""} · {latest.contextFetchedAt ? `futbol okuması ${formatIstanbulDateTime(latest.contextFetchedAt)}` : "futbol okuması yok"}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-2">
              <section className="flex flex-col gap-2">
                <h2 className="text-sm font-medium text-white">Sahne uygunluğu</h2>
                <ul className="flex flex-col gap-1.5 text-sm">
                  {REEL_SCENE_IDS.map((scene) => {
                    const state = availability.scenes[scene];
                    return (
                      <li key={scene} className="flex items-start gap-2">
                        <Mark ok={state.available} />
                        <span className="text-white">{scene} {REEL_SCENE_LABELS[scene]}</span>
                        <span className="text-muted-foreground">{state.available ? "" : state.reason}</span>
                      </li>
                    );
                  })}
                </ul>
              </section>
              {groups ? (
                <section className="flex flex-col gap-4">
                  <h2 className="text-sm font-medium text-white">Kalite kontrolleri</h2>
                  <div className="flex flex-col gap-2">
                    <SubHeading>Zorunlu</SubHeading>
                    <CheckList checks={groups.required} />
                  </div>
                  <div className="flex flex-col gap-2">
                    <SubHeading>Sahneyi etkileyen · M2 En olası skor</SubHeading>
                    <CheckList checks={groups.scoreScene} />
                    {groups.scoreSceneClosedByModels ? <p className="text-xs text-muted-foreground">Bu üç kontrol geçti; sahneyi model uyumu kapatıyor (Bilgi grubunda).</p> : null}
                  </div>
                  <div className="flex flex-col gap-2">
                    <SubHeading>Sahneyi etkileyen · M7 Golcü adayı</SubHeading>
                    <CheckList checks={groups.scorerScene} />
                  </div>
                  <div className="flex flex-col gap-2">
                    <SubHeading>Bilgi</SubHeading>
                    <CheckList checks={groups.info} muted />
                  </div>
                </section>
              ) : null}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Sürümler</CardTitle>
              <CardDescription>Dondurulan sürümler silinmez.</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="flex flex-col text-sm">
                {project.snapshots.map((snapshot) => (
                  <li key={snapshot.id} className="flex flex-wrap justify-between gap-2 border-b border-border/60 py-2 last:border-0">
                    <span className="text-white">Sürüm {snapshot.version}</span>
                    <span className="text-muted-foreground">
                      Model {snapshot.modelVersion} · hesap {formatIstanbulDateTime(snapshot.computedAt)} · donduruldu {formatIstanbulDateTime(snapshot.fetchedAt)} · {snapshot.qualityOk ? "zorunlu kontroller tamam" : "zorunlu kontrolde hata"}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </>
      )}
    </>
  );
}
