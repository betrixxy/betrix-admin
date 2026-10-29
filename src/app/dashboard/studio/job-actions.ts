"use server";

import { getCurrentSession } from "@/lib/auth/require-session";
import { studioJobView } from "@/lib/jobs/studio-jobs";
import type { StudioJobView } from "@/types/studio-job";

/** Arka plan işinin durumu (stüdyo 2 sn'de bir sorar). Oturumsuz istek işi göremez. */
export async function pollStudioJobAction(jobId: string): Promise<StudioJobView> {
  if (!(await getCurrentSession()) || typeof jobId !== "string") return { status: "missing" };
  return studioJobView(jobId);
}
