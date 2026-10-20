import { REASON_MAX_LENGTH, REASON_MAX_WORDS, SCENARIO_IDS, wordCount, type ScenarioId } from "@/types/prediction";

/**
 * Vitrin stüdyosunun kutu rolleri — saf, istemcide de çalışır. Her rolün kapasitesi sabittir
 * (2 açık · 3 kilitli · 1 kartta yok = 6 senaryo). Dolu bir rol seçilince o roldeki EN ESKİ seçim,
 * seçilen senaryonun eski rolüne geçer: sayılar her zaman geçerli kalır, kullanıcı geçersiz seçimle
 * pasif butona düşmez. Kazanma olasılıkları posterin çubuğudur — her zaman açık, rolü değişmez.
 * Butonu pasif bırakan her neden `selectionIssues` ile okunur cümle olarak listelenir.
 */

export type BoxRole = "open" | "locked" | "none";

export const ROLE_CAPACITY: Record<BoxRole, number> = { open: 2, locked: 3, none: 1 };
/** Posterin kazanma çubuğu — rolü değişmez. */
export const FIXED_OPEN: ScenarioId = "RESULT_1X2";

export interface RoleState {
  roles: Record<ScenarioId, BoxRole>;
  /** Atanma sırası, en eski önce — "en eski seçim" buradan okunur. */
  order: ScenarioId[];
}

/** Varsayılan: 1X2 + iki takım gol açık; ilk yarı, gol yağmuru, senaryo kilitli; "gollü maç" kartta yok. */
export const DEFAULT_ROLE_STATE: RoleState = {
  roles: { RESULT_1X2: "open", BTTS: "open", GOALS_3PLUS: "none", GOALS_4PLUS: "locked", HT_RESULT: "locked", COMBO: "locked" },
  order: [...SCENARIO_IDS],
};

export const byRole = (roles: Record<ScenarioId, BoxRole>, role: BoxRole): ScenarioId[] => SCENARIO_IDS.filter((id) => roles[id] === role);

/** Rol atar; kapasite doluysa o roldeki en eski (sabit olmayan) senaryo `id`'nin eski rolünü alır. */
export function assignRole(state: RoleState, id: ScenarioId, role: BoxRole): RoleState {
  const previous = state.roles[id];
  if (id === FIXED_OPEN || previous === role) return state;
  const roles = { ...state.roles, [id]: role };
  const holders = state.order.filter((other) => other !== id && other !== FIXED_OPEN && roles[other] === role);
  const count = SCENARIO_IDS.filter((other) => roles[other] === role).length;
  const order = [...state.order.filter((other) => other !== id), id];
  if (count > ROLE_CAPACITY[role] && holders[0]) {
    roles[holders[0]] = previous;
    return { roles, order: [...order.filter((other) => other !== holders[0]), holders[0]] };
  }
  return { roles, order };
}

export interface SelectionCheck {
  loaded: boolean;
  busy: boolean;
  roles: Record<ScenarioId, BoxRole>;
  titles: Record<ScenarioId, string>;
  reasons: Record<ScenarioId, string>;
  /** Sunucu denetimi (yalnızca düzenlenmemiş gerekçe için geçerli). */
  serverIssues: Record<ScenarioId, string[]>;
  edited: Record<ScenarioId, boolean>;
}

/** Önizle/Kaydet butonunu pasif bırakan nedenler — hepsi, okunur cümleyle. Boş dizi = buton etkin. */
export function selectionIssues(check: SelectionCheck): string[] {
  if (!check.loaded) return ["Önce maçı seçip “Veriyi yükle”ye basın."];
  const issues: string[] = [];
  if (check.busy) issues.push("Bir işlem sürüyor — bitmesini bekleyin.");
  const open = byRole(check.roles, "open");
  const locked = byRole(check.roles, "locked");
  if (open.length > ROLE_CAPACITY.open) issues.push(`En fazla ${ROLE_CAPACITY.open} açık kutu seçilebilir (şu an ${open.length}).`);
  if (open.length < ROLE_CAPACITY.open) issues.push(`${ROLE_CAPACITY.open} açık kutu gerekli (şu an ${open.length}).`);
  if (locked.length !== ROLE_CAPACITY.locked) issues.push(`${ROLE_CAPACITY.locked} kilitli kutu gerekli (şu an ${locked.length}).`);
  if (check.roles[FIXED_OPEN] !== "open") issues.push("Kazanma olasılıkları her zaman açık kutu olmalı (posterin çubuğu).");
  for (const id of open) {
    const title = check.titles[id] ?? id;
    const reason = (check.reasons[id] ?? "").trim();
    if (!reason) {
      issues.push(`${title}: gerekçe boş.`);
      continue;
    }
    if (check.edited[id]) {
      // Düzenlenen gerekçe: tarayıcıda ölçülebilenler; tam denetim önizleme/kayıtta sunucuda.
      const words = wordCount(reason);
      if (words > REASON_MAX_WORDS) issues.push(`${title}: gerekçe ${words} sözcük (en fazla ${REASON_MAX_WORDS}).`);
      if (reason.length > REASON_MAX_LENGTH) issues.push(`${title}: gerekçe ${reason.length} karakter (en fazla ${REASON_MAX_LENGTH}).`);
      continue;
    }
    const server = check.serverIssues[id] ?? [];
    if (server.length) issues.push(`${title}: ${server.join(" · ")}.`);
  }
  return [...new Set(issues)];
}
