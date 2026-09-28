"use client";

import { useActionState, useTransition, type FormEvent } from "react";
import { AlertCircle, Check, CheckCircle2, X } from "lucide-react";
import { decideDraftAction } from "@/app/dashboard/drafts/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import type { StudioPostOption } from "@/types/ai-content";
import type { DraftActionState } from "@/types/draft";

const INITIAL_STATE: DraftActionState = {};

interface DraftDecisionFormProps {
  id: string;
  postOptions: StudioPostOption[];
  currentPostId: string | null;
}

/** Onayla / Reddet — insan onayının son adımı. Onaylanan içerik yayına hazır sayılır. */
export function DraftDecisionForm({ id, postOptions, currentPostId }: DraftDecisionFormProps) {
  const [state, formAction, isPending] = useActionState(decideDraftAction, INITIAL_STATE);
  const [, startTransition] = useTransition();

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    formData.set("decision", submitter?.getAttribute("value") === "REJECTED" ? "REJECTED" : "APPROVED");
    startTransition(() => formAction(formData));
  }

  return (
    <Card className="ring-1 ring-emerald-500/20">
      <CardHeader>
        <CardTitle>Karar</CardTitle>
        <CardDescription>Görseli ve metni kontrol ettiyseniz onaylayın; uygun değilse reddedin.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <input type="hidden" name="id" value={id} />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="postId">Gönderiye bağla (isteğe bağlı)</Label>
            <NativeSelect id="postId" name="postId" defaultValue={currentPostId ?? ""}>
              <option value="">Bağlama</option>
              {postOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </NativeSelect>
            {postOptions.length === 0 ? (
              <span className="text-[11px] text-muted-foreground">Bu maç için planlanmış gönderi yok (İçerik Takvimi&apos;nden eklenebilir).</span>
            ) : null}
          </div>

          {state.error ? (
            <p className="flex items-center gap-1.5 text-xs text-destructive" role="alert">
              <AlertCircle className="size-3.5 shrink-0" />
              {state.error}
            </p>
          ) : state.notice ? (
            <p className="flex items-center gap-1.5 text-xs text-emerald-400" role="status">
              <CheckCircle2 className="size-3.5 shrink-0" />
              {state.notice}
            </p>
          ) : null}

          <div className="grid grid-cols-2 gap-2">
            <Button type="submit" value="APPROVED" disabled={isPending} className="bg-emerald-600 text-white hover:bg-emerald-500">
              <Check />
              Onayla
            </Button>
            <Button type="submit" value="REJECTED" variant="destructive" disabled={isPending}>
              <X />
              Reddet
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
