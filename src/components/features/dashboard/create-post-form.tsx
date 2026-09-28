"use client";

import { useEffect, useRef } from "react";
import { AlertCircle, Plus } from "lucide-react";
import { createSocialPostAction } from "@/app/dashboard/calendar/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useActionForm } from "@/hooks/use-action-form";
import type { FixtureOption, SocialActionState } from "@/types/social";
import { PostFields } from "./post-fields";

const INITIAL_STATE: SocialActionState = {};

export function CreatePostForm({ fixtures }: { fixtures: FixtureOption[] }) {
  const { state, isPending, onSubmit } = useActionForm(createSocialPostAction, INITIAL_STATE);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Yeni Gönderi Planla</CardTitle>
        <CardDescription>Takvime &quot;Hazırlanıyor&quot; durumunda eklenir.</CardDescription>
      </CardHeader>
      <CardContent>
        <form ref={formRef} onSubmit={onSubmit} className="flex flex-col gap-3.5">
          <PostFields fixtures={fixtures} />

          {state.error ? (
            <p className="flex items-center gap-1.5 text-xs text-destructive" role="alert">
              <AlertCircle className="size-3.5 shrink-0" />
              {state.error}
            </p>
          ) : null}
          {state.success ? <p className="text-xs text-emerald-400">Gönderi takvime eklendi.</p> : null}

          <Button type="submit" disabled={isPending}>
            <Plus />
            {isPending ? "Kaydediliyor…" : "Gönderiyi Planla"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
