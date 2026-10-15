/**
 * Oturum bazlı atıf — saf fonksiyonlar (bkz. CLAUDE.md 4.3). Bir sayfa görüntülemesinde UTM/gönderi yoksa,
 * aynı oturumun (snippet `cm_sid`; yoksa aynı ziyaretçinin son 30 dakikası) ilk atıflı ziyaretinden devralınır.
 */

export interface UtmParams {
  source: string | null;
  medium: string | null;
  campaign: string | null;
  content: string | null;
  term: string | null;
}

export interface Attribution {
  utm: UtmParams;
  postId: string | null;
  inherited: boolean;
}

export const EMPTY_UTM: UtmParams = { source: null, medium: null, campaign: null, content: null, term: null };

/** Eski snippet oturum kimliği göndermez: aynı ziyaretçinin bu süre içindeki önceki ziyareti aynı oturum sayılır. */
export const SESSION_FALLBACK_WINDOW_MS = 30 * 60_000;

const clean = (value: string | null | undefined, max = 200): string | null => {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, max) : null;
};

export function normalizeUtm(input: Partial<Record<keyof UtmParams, string | null | undefined>> | null | undefined): UtmParams {
  return {
    source: clean(input?.source)?.toLowerCase() ?? null,
    medium: clean(input?.medium)?.toLowerCase() ?? null,
    campaign: clean(input?.campaign),
    content: clean(input?.content),
    term: clean(input?.term),
  };
}

export function hasUtm(utm: UtmParams): boolean {
  return utm.source !== null || utm.campaign !== null || utm.content !== null;
}

/**
 * Bu görüntülemenin atfı: kendi UTM'i/gönderisi varsa o (ilk dokunuş bu ziyarette), yoksa oturumun ilk atıflı
 * ziyaretinden devralınır. `utm_content` bir SocialPost kimliği olabilir — doğrulaması `/api/track`'tedir.
 */
export function resolveAttribution(
  current: { utm: UtmParams; postId: string | null },
  sessionFirst: { utm: UtmParams; postId: string | null } | null,
): Attribution {
  if (hasUtm(current.utm) || current.postId) return { utm: current.utm, postId: current.postId, inherited: false };
  if (sessionFirst && (hasUtm(sessionFirst.utm) || sessionFirst.postId)) return { utm: sessionFirst.utm, postId: sessionFirst.postId, inherited: true };
  return { utm: current.utm, postId: null, inherited: false };
}
