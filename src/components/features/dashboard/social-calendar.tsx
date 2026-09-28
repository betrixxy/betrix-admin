import Link from "next/link";
import {
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { PLATFORM_DOT_CLASS, PLATFORM_LABELS } from "@/lib/dashboard/social-meta";
import { cn } from "@/lib/utils";
import type { SocialPostView } from "@/types/social";

const WEEKDAY_LABELS = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"] as const;
const MAX_CHIPS_PER_DAY = 3;

interface SocialCalendarProps {
  anchor: Date;
  posts: SocialPostView[];
  editHref: (postId: string) => string;
}

export function groupPostsByDay(posts: SocialPostView[]): Map<string, SocialPostView[]> {
  const byDay = new Map<string, SocialPostView[]>();
  for (const post of posts) {
    const key = format(new Date(post.scheduledFor), "yyyy-MM-dd");
    byDay.set(key, [...(byDay.get(key) ?? []), post]);
  }
  return byDay;
}

export function SocialCalendar({ anchor, posts, editHref }: SocialCalendarProps) {
  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(anchor), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(anchor), { weekStartsOn: 1 }),
  });
  const postsByDay = groupPostsByDay(posts);

  return (
    <Card>
      <CardContent>
        <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg bg-border ring-1 ring-border">
          {WEEKDAY_LABELS.map((label) => (
            <div key={label} className="bg-card px-2 py-1.5 text-center text-[11px] font-medium text-muted-foreground">
              {label}
            </div>
          ))}

          {days.map((day) => {
            const dayPosts = postsByDay.get(format(day, "yyyy-MM-dd")) ?? [];
            const overflow = dayPosts.length - MAX_CHIPS_PER_DAY;

            return (
              <div
                key={day.toISOString()}
                className={cn("flex min-h-24 flex-col gap-1 bg-card p-1.5", !isSameMonth(day, anchor) && "opacity-40")}
              >
                <span
                  className={cn(
                    "flex size-5 items-center justify-center self-end rounded-full text-[11px] text-muted-foreground",
                    isToday(day) && "bg-emerald-500 font-semibold text-black",
                  )}
                >
                  {format(day, "d")}
                </span>

                {dayPosts.slice(0, MAX_CHIPS_PER_DAY).map((post) => (
                  <Link
                    key={post.id}
                    href={editHref(post.id)}
                    title={`${PLATFORM_LABELS[post.platform.type]} · ${post.caption}`}
                    className={cn(
                      "flex items-center gap-1 truncate rounded px-1.5 py-0.5 text-[10px] transition-opacity hover:opacity-80",
                      post.status === "PUBLISHED"
                        ? "bg-emerald-500/10 text-emerald-300"
                        : "bg-amber-500/10 text-amber-300",
                    )}
                  >
                    <span className={cn("size-1.5 shrink-0 rounded-full", PLATFORM_DOT_CLASS[post.platform.type])} />
                    <span className="truncate">
                      {format(new Date(post.scheduledFor), "HH:mm")} {post.platform.displayName}
                    </span>
                  </Link>
                ))}

                {overflow > 0 ? <span className="px-1 text-[10px] text-muted-foreground">+{overflow} daha</span> : null}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
