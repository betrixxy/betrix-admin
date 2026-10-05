"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addHours, format, subHours } from "date-fns";
import { LoaderCircle } from "lucide-react";
import { scheduleContentAction } from "@/app/calendar/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ContentTypeDef } from "@/types/content-type";

/** Varsayılan öneri: maç öncesi içerik başlamadan 3 saat önce, maç sonrası bitişten sonra. */
const PRE_MATCH_LEAD_HOURS = 3;
const POST_MATCH_DELAY_HOURS = 2;

/** `<input type="datetime-local">` değeri — tarayıcının yerel saatinde. */
function toLocalInputValue(date: Date): string {
  return format(date, "yyyy-MM-dd'T'HH:mm");
}

function suggestPublishAt(type: ContentTypeDef, kickoffUtc: string): Date {
  const kickoff = new Date(kickoffUtc);
  return type.phase === "pre_match" ? subHours(kickoff, PRE_MATCH_LEAD_HOURS) : addHours(kickoff, POST_MATCH_DELAY_HOURS);
}

interface ContentScheduleEditorProps {
  fixtureId: string;
  kickoffUtc: string;
  type: ContentTypeDef;
  publishAt: string | null;
  onClose: () => void;
}

/** Satırın altında açılan tek satırlık yayın zamanı düzenleyicisi (bkz. scheduleContentAction). */
export function ContentScheduleEditor({ fixtureId, kickoffUtc, type, publishAt, onClose }: ContentScheduleEditorProps) {
  const router = useRouter();
  const [value, setValue] = useState(() => toLocalInputValue(publishAt ? new Date(publishAt) : suggestPublishAt(type, kickoffUtc)));
  const [error, setError] = useState<string | null>(null);
  const [isSaving, startSaving] = useTransition();

  function submit(next: string | null) {
    setError(null);
    startSaving(async () => {
      const result = await scheduleContentAction(fixtureId, type.id, next);
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      router.refresh();
      onClose();
    });
  }

  function handleSave() {
    const date = new Date(value);
    if (!value || Number.isNaN(date.getTime())) {
      setError("Geçerli bir tarih ve saat seçin.");
      return;
    }
    submit(date.toISOString());
  }

  return (
    <div className="mt-2 flex flex-col gap-1.5 rounded-lg border border-border/60 bg-white/[0.02] p-2">
      <div className="flex items-center gap-1.5">
        <Input
          type="datetime-local"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          aria-label={`${type.label} yayın zamanı`}
          className="h-7 flex-1 text-xs [color-scheme:dark]"
          disabled={isSaving}
        />
        <Button size="xs" onClick={handleSave} disabled={isSaving}>
          {isSaving && <LoaderCircle className="animate-spin" />}
          Kaydet
        </Button>
        {publishAt && (
          <Button size="xs" variant="ghost" onClick={() => submit(null)} disabled={isSaving}>
            Kaldır
          </Button>
        )}
        <Button size="xs" variant="ghost" onClick={onClose} disabled={isSaving}>
          Vazgeç
        </Button>
      </div>
      {error && <p className="text-[11px] text-destructive">{error}</p>}
    </div>
  );
}
