import { AlertCircle, CheckCircle2 } from "lucide-react";
import type { SocialActionState } from "@/types/social";

/** Server Action sonucunun kısa bildirimi (hata / bilgi). */
export function ActionNotice({ state }: { state: SocialActionState }) {
  if (state.error) {
    return (
      <p className="flex items-start gap-1.5 text-xs text-destructive" role="alert">
        <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
        {state.error}
      </p>
    );
  }
  if (state.notice) {
    return (
      <p className="flex items-start gap-1.5 text-xs text-emerald-400" role="status">
        <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" />
        {state.notice}
      </p>
    );
  }
  return null;
}
