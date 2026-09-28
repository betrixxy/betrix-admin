import type { Metadata } from "next";
import { CalendarToolbar } from "@/components/features/dashboard/calendar-toolbar";
import { CreatePostForm } from "@/components/features/dashboard/create-post-form";
import { EditPostSheet } from "@/components/features/dashboard/edit-post-sheet";
import { PageHeader } from "@/components/features/dashboard/page-header";
import { PostsTable } from "@/components/features/dashboard/posts-table";
import { SocialCalendar } from "@/components/features/dashboard/social-calendar";
import { SocialWeek } from "@/components/features/dashboard/social-week";
import { Badge } from "@/components/ui/badge";
import { getCalendarSummary, getPostById, getPostsInRange, getRecentPosts } from "@/lib/dashboard/calendar-data";
import { calendarHref, parseAnchor, parseView, resolveRange } from "@/lib/dashboard/calendar-range";
import { getFixtureLabels, getFixtureOptions } from "@/lib/dashboard/fixtures";
import { STATUS_BADGE_CLASS, STATUS_LABELS } from "@/lib/dashboard/social-meta";

export const metadata: Metadata = {
  title: "İçerik Takvimi — betrix.pro",
  description: "Hangi gün, hangi maçın içeriğinin paylaşılacağını planlayın",
};

// Veritabanından okunan canlı veri — statik önbelleğe alınmaz (bkz. CLAUDE.md 1.5).
export const dynamic = "force-dynamic";

const LIST_LIMIT = 50;

interface CalendarPageProps {
  searchParams: Promise<{ view?: string | string[]; date?: string | string[]; edit?: string | string[] }>;
}

export default async function CalendarPage({ searchParams }: CalendarPageProps) {
  const params = await searchParams;
  const view = parseView(params.view);
  const anchor = parseAnchor(params.date);
  const range = resolveRange(view, anchor);
  const editId = typeof params.edit === "string" ? params.edit : undefined;

  const [summary, posts, editingPost] = await Promise.all([
    getCalendarSummary(),
    view === "list" ? getRecentPosts(LIST_LIMIT) : getPostsInRange(range.from, range.to),
    editId ? getPostById(editId) : Promise.resolve(null),
  ]);

  const fixtureOptions = getFixtureOptions();
  const fixtureLabels = getFixtureLabels();
  const editHref = (postId: string) => calendarHref({ view, anchor, edit: postId });

  return (
    <>
      <PageHeader
        title="İçerik Üretim Takvimi"
        description="Hangi gün, hangi maçın içeriğinin hangi platformda paylaşılacağını planlayın; gönderileri düzenleyin ve Hazırlanıyor / Paylaşıldı durumlarını yönetin."
        actions={
          <div className="flex items-center gap-2">
            <Badge className={STATUS_BADGE_CLASS.PREPARING}>
              {summary.preparingCount} {STATUS_LABELS.PREPARING}
            </Badge>
            <Badge className={STATUS_BADGE_CLASS.PUBLISHED}>
              {summary.publishedCount} {STATUS_LABELS.PUBLISHED}
            </Badge>
          </div>
        }
      />

      <CalendarToolbar view={view} anchor={anchor} />

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          {view === "month" ? <SocialCalendar anchor={anchor} posts={posts} editHref={editHref} /> : null}
          {view === "week" ? (
            <SocialWeek anchor={anchor} posts={posts} fixtureLabels={fixtureLabels} editHref={editHref} />
          ) : null}
          {view === "list" ? (
            <PostsTable
              posts={posts}
              fixtureLabels={fixtureLabels}
              editHref={editHref}
              description={`Planlanan tarihe göre en yeni ${posts.length} gönderi`}
            />
          ) : null}
        </div>
        <CreatePostForm fixtures={fixtureOptions} />
      </div>

      {view !== "list" ? (
        <PostsTable
          posts={posts}
          fixtureLabels={fixtureLabels}
          editHref={editHref}
          title="Bu dönemdeki gönderiler"
          description={`${posts.length} gönderi — düzenlemek için satırdaki kalem simgesine tıklayın`}
        />
      ) : null}

      {editingPost ? (
        <EditPostSheet
          key={editingPost.id}
          post={editingPost}
          fixtures={fixtureOptions}
          closeHref={calendarHref({ view, anchor })}
        />
      ) : null}
    </>
  );
}
