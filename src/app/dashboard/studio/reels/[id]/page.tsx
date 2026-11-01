import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowLeft, Check, X } from "lucide-react";
import { PageHeader } from "@/components/features/dashboard/page-header";
import { FreezeButton } from "@/components/features/dashboard/reels-action-buttons";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { competitionShortName } from "@/lib/names/competition-names";
import { prisma } from "@/lib/prisma";
import { formatIstanbulDateTime, formatPublishWindow, publishWindowState } from "@/lib/reels/publish-window";
import { reelCheckLabel, REEL_SCENE_IDS, REEL_SCENE_LABELS, type ReelSceneAvailability } from "@/lib/reels/scenes";
import { canFreezeReel, REEL_STATUS_LABELS } from "@/lib/reels/selection";
import { reelsCheckSchema, type ReelsCheck } from "@/lib/services/reels-schema";

export const metadata: Metadata = { title: "Reels projesi — betrix.pro" };

export const dynamic = "force-dynamic";

/** Dondurulmuş yanıttan yalnız kalite satırları okunur; ham yanıt ekrana çıkmaz. */
function storedChecks(payload: unknown): ReelsCheck[] {
  const quality = payload && typeof payload === "object" && "quality" in payload ? payload.quality : null;
  const checks = quality && typeof quality === "object" && "checks" in quality ? quality.checks : null;
  return Array.isArray(checks) ? checks.flatMap((check) => {
    const parsed = reelsCheckSchema.safeParse(check);
    return parsed.success ? [parsed.data] : [];
  }) : [];
}

function storedSimulations(payload: unknown): number | null {
  const model = payload && typeof payload === "object" && "model" in payload ? payload.model : null;
  const value = model && typeof model === "object" && "simulations" in model ? model.simulations : null;
  return typeof value === "number" ? value : null;
}

function Mark({ ok }: { ok: boolean }) {
  return ok ? <Check className="size-4 shrink-0 text-emerald-300" /> : <X className="size-4 shrink-0 text-amber-300" />;
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
  const checks = latest ? storedChecks(latest.payload) : [];
  const simulations = latest ? storedSimulations(latest.payload) : null;
  const passed = checks.filter((check) => check.ok).length;
  const freezeBlocked = canFreezeReel(project.status) ? null : "Onaydan sonra yeni veri dondurulamaz.";

  return (
    <>
      <Link href="/dashboard/studio/reels" className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-white">
        <ArrowLeft className="size-4" />
        Reels Stüdyo
      </Link>
      <PageHeader
        title={`${project.homeName} – ${project.awayName}`}
        description={`${competitionShortName(project.leagueId, project.leagueName)} · ${formatIstanbulDateTime(project.kickoffUtc)} (İstanbul)`}
        actions={<FreezeButton projectId={project.id} hasSnapshot={latest !== undefined} disabledReason={freezeBlocked} />}
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

      {!latest || !availability ? (
        <Card>
          <CardHeader>
            <CardTitle>Veri henüz dondurulmadı</CardTitle>
            <CardDescription>Veriyi dondur düğmesi model çıktısının o anki hâlini kaydeder.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Sürüm {latest.version}</CardTitle>
              <CardDescription>
                Model {latest.modelVersion} · hesap {formatIstanbulDateTime(latest.computedAt)} · simülasyon {simulations?.toLocaleString("tr-TR") ?? "yok"} · donduruldu {formatIstanbulDateTime(latest.fetchedAt)}
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
              <section className="flex flex-col gap-2">
                <h2 className="text-sm font-medium text-white">Kalite kontrolleri · {passed}/{checks.length} geçti</h2>
                <ul className="flex flex-col gap-1.5 text-sm">
                  {checks.map((check) => (
                    <li key={check.name} className="flex items-start gap-2">
                      <Mark ok={check.ok} />
                      <span className="text-white">{reelCheckLabel(check.name)}</span>
                    </li>
                  ))}
                </ul>
              </section>
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
                      Model {snapshot.modelVersion} · hesap {formatIstanbulDateTime(snapshot.computedAt)} · donduruldu {formatIstanbulDateTime(snapshot.fetchedAt)} · {snapshot.qualityOk ? "kalite tamam" : "kalite sorunlu"}
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
