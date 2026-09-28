"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { deleteAiContentAction } from "@/app/dashboard/studio/actions";
import { Button } from "@/components/ui/button";

export function AiContentDeleteButton({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      variant="ghost"
      size="icon-xs"
      aria-label="Görseli sil"
      disabled={isPending}
      onClick={() => startTransition(async () => void (await deleteAiContentAction(id)))}
    >
      <Trash2 />
    </Button>
  );
}
