import type { PostFeatures } from "@/generated/prisma/client";
import { getContentType } from "@/lib/dashboard/content-types";
import { formatNumber } from "@/lib/dashboard/format";

const WEEKDAYS = ["", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"];
const LINK_PLACEMENT: Record<string, string> = { BODY: "metinde", FIRST_REPLY: "ilk yanıtta", NONE: "yok" };

function kickoffText(hours: number | null): string {
  if (hours === null) return "—";
  const abs = Math.abs(hours);
  const text = abs >= 48 ? `${Math.round(abs / 24)} gün` : `${Math.round(abs * 10) / 10} saat`;
  return hours < 0 ? `maçtan ${text} önce` : `maçtan ${text} sonra`;
}

/** Yayın anında kaydedilen analiz özellikleri (bkz. CLAUDE.md 4.4). */
export function PostFeaturesList({ features }: { features: PostFeatures | null }) {
  if (!features) return <p className="text-sm text-muted-foreground">Bu gönderi için analiz özellikleri henüz hesaplanmadı.</p>;
  const rows: [string, string][] = [
    ["Yayın saati (İstanbul)", `${String(features.publishedHourIst).padStart(2, "0")}:00 · ${WEEKDAYS[features.weekdayIst] ?? ""}`],
    ["Maça göre", kickoffText(features.hoursFromKickoff)],
    ["İçerik türü", features.contentType ? (getContentType(features.contentType)?.label ?? features.contentType) : "—"],
    ["Format / şablon", [features.format, features.templateName].filter(Boolean).join(" · ") || "—"],
    ["Görsel sayısı", formatNumber(features.mediaCount)],
    ["Açıklama", `${formatNumber(features.captionChars)} karakter · ${formatNumber(features.captionWords)} kelime · ${features.emojiCount} emoji${features.hasQuestion ? " · soru içeriyor" : ""}`],
    ["Hashtag", features.hashtags.length > 0 ? features.hashtags.map((tag) => `#${tag}`).join(" ") : "—"],
    ["Bağlantı", LINK_PLACEMENT[features.linkPlacement] ?? features.linkPlacement],
    ["Maç", [features.league, features.homeTeam && features.awayTeam ? `${features.homeTeam} – ${features.awayTeam}` : null, features.isDerby ? "derbi" : null].filter(Boolean).join(" · ") || "—"],
    ["Paylaşım anındaki takipçi", features.followersAtPublish === null ? "—" : formatNumber(features.followersAtPublish)],
  ];
  return (
    <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
      {rows.map(([label, value]) => (
        <div key={label} className="flex flex-col">
          <dt className="text-[11px] text-muted-foreground">{label}</dt>
          <dd className="text-white">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
