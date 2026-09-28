import Link from "next/link";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCompactNumber } from "@/lib/dashboard/format";
import { PLATFORM_DOT_CLASS, STATUS_BADGE_CLASS, STATUS_LABELS } from "@/lib/dashboard/social-meta";
import { cn } from "@/lib/utils";
import type { SocialPostView } from "@/types/social";
import { PostRowActions } from "./post-row-actions";

interface PostsTableProps {
  posts: SocialPostView[];
  /** fixtureId -> "Ev – Deplasman" etiketi; bulunamazsa ham ID gösterilir. */
  fixtureLabels: Record<string, string>;
  editHref: (postId: string) => string;
  title?: string;
  description?: string;
}

export function PostsTable({
  posts,
  fixtureLabels,
  editHref,
  title = "Gönderiler",
  description = `Planlanan tarihe göre en yeni ${posts.length} gönderi`,
}: PostsTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {posts.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Henüz gönderi yok — formdan ilk gönderiyi planlayın.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Platform</TableHead>
                <TableHead>Maç / Metin</TableHead>
                <TableHead>Planlanan</TableHead>
                <TableHead>Durum</TableHead>
                <TableHead className="text-right">İzlenme</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {posts.map((post) => (
                <TableRow key={post.id}>
                  <TableCell>
                    <span className="flex items-center gap-2 text-white">
                      <span className={cn("size-2 rounded-full", PLATFORM_DOT_CLASS[post.platform.type])} />
                      {post.platform.displayName}
                    </span>
                  </TableCell>
                  <TableCell className="max-w-64">
                    <div className="truncate text-white">{fixtureLabels[post.fixtureId] ?? post.fixtureId}</div>
                    <div className="truncate text-xs text-muted-foreground">{post.caption}</div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {format(new Date(post.scheduledFor), "d MMM, HH:mm", { locale: tr })}
                  </TableCell>
                  <TableCell>
                    <Badge className={STATUS_BADGE_CLASS[post.status]}>{STATUS_LABELS[post.status]}</Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCompactNumber(post.analytics?.views ?? 0)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Link
                        href={editHref(post.id)}
                        aria-label="Gönderiyi düzenle"
                        className={buttonVariants({ variant: "ghost", size: "icon-xs" })}
                      >
                        <Pencil />
                      </Link>
                      <PostRowActions postId={post.id} status={post.status} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
