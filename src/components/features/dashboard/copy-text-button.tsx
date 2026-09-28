"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Onaylanan metni platforma elle yapıştırmak için panoya kopyalar. */
export function CopyTextButton({ text, label = "Metni kopyala" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Button type="button" variant="outline" onClick={copy} className="w-full">
      {copied ? <Check /> : <Copy />}
      {copied ? "Kopyalandı" : label}
    </Button>
  );
}
