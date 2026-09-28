"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { deleteMediaAction } from "@/app/dashboard/library/actions";

/** İki adımlı silme (tarayıcı `confirm()` diyaloğu yok): ilk tık onay ister, ikinci tık siler. */
export function MediaDeleteButton({ id }: { id: string }) {
  const [armed, setArmed] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    if (!armed) {
      setArmed(true);
      setTimeout(() => setArmed(false), 3000);
      return;
    }
    startTransition(async () => {
      const result = await deleteMediaAction(id);
      setMessage(result.ok ? null : result.error.message);
    });
  }

  return (
    <span className="flex flex-col items-end">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className={`flex items-center gap-1 rounded px-1 text-[10px] transition-colors ${armed ? "text-destructive" : "text-muted-foreground hover:text-white"}`}
        aria-label="Görseli sil"
      >
        <Trash2 className="size-3" />
        {armed ? "Emin misiniz?" : null}
      </button>
      {message ? <span className="text-[10px] text-destructive">{message}</span> : null}
    </span>
  );
}
