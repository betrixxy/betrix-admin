import Link from "next/link";
import { eachDayOfInterval, endOfWeek, format, isToday, startOfWeek } from "date-fns";
import { tr } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import { PLATFORM_DOT_CLASS, STATUS_LABELS } from "@/lib/dashboard/social-meta";
import { cn } from "@/lib/utils";
import type { SocialPostView } from "@/types/social";
import { groupPostsByDay } from "./social-calendar";

interface SocialWeekProps {
  anchor: Date;
  posts: SocialPostView[];
  fixtureLabels: Record<string, string>;
  editHref: (postId: string) => string;
}

/** Haftalık görünüm: her gün bir sütun, gönderiler saat sırasıyla tam kart olarak listelenir. */
export function SocialWeek({ anchor, posts, fixtureLabels, editHref }: SocialWeekProps) {
  const days = eachDayOfInterval({
    start: startOfWeek(anchor, { weekStartsOn: 1 }),
    end: endOfWeek(anchor, { weekStartsOn: 1 }),
  });
  const postsByDay = groupPostsByDay(posts);

  return (
    <Card>
      <CardContent>
        <div className="grid gap-2 md:grid-cols-7">
          {days.map((day) => {
            const dayPosts = postsByDay.get(format(day, "yyyy-MM-dd")) ?? [];
            return (
              <div key={day.toISOString()} className="flex min-h-40 flex-col gap-2 rounded-lg bg-muted/30 p-2">
                <div className="flex items-baseline justify-between">
                  <span className="text-[11px] font-medium text-muted-foreground">
                    {format(day, "EEE", { locale: tr })}
                  </span>
                  <span
                    className={cn(
                      "flex size-6 items-center justify-center rounded-full text-xs",
                      isToday(day) ? "bg-emerald-500 font-semibold text-black" : "text-white",
                    )}
                  >
                    {format(day, "d")}
                  </span>
                </div>

                {dayPosts.length === 0 ? (
                  <span className="text-[11px] text-muted-foreground/60">Gönderi yok</span>
                ) : (
                  dayPosts.map((post) => (
                    <Link
                      key={post.id}
                      href={editHref(post.id)}
                      className="flex flex-col gap-1 rounded-md bg-card p-2 ring-1 ring-border transition-colors hover:bg-muted"
                    >
                      <span className="flex items-center gap-1.5 text-[11px] text-white">
                        <span className={cn("size-1.5 rounded-full", PLATFORM_DOT_CLASS[post.platform.type])} />
                        {format(new Date(post.scheduledFor), "HH:mm")} · {post.platform.displayName}
                      </span>
                      <span className="truncate text-[11px] text-muted-foreground">
                        {fixtureLabels[post.fixtureId] ?? post.fixtureId}
                      </span>
                      <span className={cn("text-[10px]", post.status === "PUBLISHED" ? "text-emerald-400" : "text-amber-400")}>
                        {STATUS_LABELS[post.status]}
                      </span>
                    </Link>
                  ))
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
